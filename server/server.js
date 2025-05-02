const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const db = require('./database/db');
const { addQuoteToSheet } = require('./googleSheets');
const { 
  formatInitialAnalysisPrompt, 
  formatFinalQuotePrompt 
} = require('./prompt-template');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Add CORS headers for SharedArrayBuffer support
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Add content type middleware to ensure JavaScript files are served with the correct MIME type
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

// In production, serve from the dist directory first (for bundle.js and other webpack outputs)
if (process.env.NODE_ENV === 'production') {
  console.log('Serving static files from dist directory');
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// Then serve static files from public directory (for other static assets)
console.log('Serving static files from public directory');
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Configure multer for video uploads (disk storage for local saving)
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videoDir);
  },
  filename: function (req, file, cb) {
    const quoteId = req.body.quoteId || 'unknown';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${quoteId}_${timestamp}${extension}`);
  }
});

const videoUpload = multer({ 
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Serve uploaded videos
app.use('/uploads/videos', express.static(path.join(__dirname, '..', 'uploads', 'videos')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// API endpoint for analyzing images
app.post('/api/analyze', imageUpload.array('images'), async (req, res) => {
  try {
    console.log(`Received ${req.files.length} images for analysis`);
    
    // Get cleaning context if provided
    const cleaningContext = req.body.context || '';
    console.log('Cleaning context provided:', cleaningContext ? 'Yes' : 'No');
    if (cleaningContext) {
      console.log('Context content:', cleaningContext.substring(0, 100) + (cleaningContext.length > 100 ? '...' : ''));
    }
    
    // Sort the images by filename to ensure they're in the correct order
    const sortedImages = [...req.files].sort((a, b) => {
      const aMatch = a.originalname.match(/frame_(\d+)/);
      const bMatch = b.originalname.match(/frame_(\d+)/);
      
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      
      return a.originalname.localeCompare(b.originalname);
    });
    
    // Prepare image content for OpenAI API
    const imageContents = sortedImages.map(file => {
      // Read the file as base64
      const base64Image = fs.readFileSync(file.path, { encoding: 'base64' });
      
      // Delete the temporary file
      fs.unlinkSync(file.path);
      
      return {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`
        }
      };
    });

    // Construct the initial analysis prompt with cleaning context
    const promptText = formatInitialAnalysisPrompt(cleaningContext);
    
    console.log('Sending initial analysis request to OpenAI API...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            ...imageContents
          ]
        }
      ],
      max_tokens: 4096,
    });
    
    const analysis = response.choices[0].message.content.trim();
    console.log('Initial analysis received from OpenAI API');
    
    // Parse the JSON response
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysis);
      
      // Validate the structure of the parsed JSON
      if (!parsedAnalysis.summary || !parsedAnalysis.rooms || !parsedAnalysis.activities) {
        throw new Error('Invalid response structure');
      }
      
      // Send the parsed analysis to the client
      res.json({
        success: true,
        initialAnalysis: parsedAnalysis,
        quoteId: `QQ${Math.floor(Math.random() * 10000)}`
      });
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.error('Raw response:', analysis);
      res.status(500).json({
        success: false,
        error: 'Failed to parse the analysis response',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Error during image analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze images',
      details: error.message
    });
  }
});

// API endpoint for generating the final quote
app.post('/api/generate-quote', express.json(), async (req, res) => {
  try {
    const { cleaningContext, activityCounts, quoteId } = req.body;
    
    if (!activityCounts || !activityCounts.rooms || !activityCounts.activities) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid activity counts'
      });
    }
    
    console.log('Generating final quote with adjusted activity counts');
    console.log('Activity counts:', JSON.stringify(activityCounts));
    
    // Construct the final quote prompt
    const promptText = formatFinalQuotePrompt(cleaningContext, activityCounts);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: promptText
        }
      ],
      max_tokens: 4096,
    });
    
    const quote = response.choices[0].message.content.trim();
    console.log('Final quote received from OpenAI API');
    
    res.json({
      success: true,
      quote,
      quoteId: quoteId || `QQ${Math.floor(Math.random() * 10000)}`
    });
  } catch (error) {
    console.error('Error generating final quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quote',
      details: error.message
    });
  }
});

// API endpoint for saving quotes
app.post('/api/save-quote', express.json(), async (req, res) => {
  try {
    const { quoteId, quoteText, userInfo, cleaningContext, activityCounts } = req.body;
    
    // Validate all required fields are present
    if (!quoteId || !quoteText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract the estimated price from the quote text
    const priceMatch = quoteText.match(/£(\d+)/);
    const estimatedPrice = priceMatch ? priceMatch[1] : 'Not specified';

    console.log(`Saving quote ${quoteId} with estimated price £${estimatedPrice}`);

    // Save to Google Sheets if configured
    try {
      if (process.env.GOOGLE_SHEET_ID) {
        console.log('Adding quote to Google Sheet...');
        
        // Format the data for Google Sheets
        const quoteData = {
          quoteId,
          timestamp: new Date().toISOString(),
          userInfo,
          cleaningContext: cleaningContext || '',
          activityCounts: activityCounts ? JSON.stringify(activityCounts) : '{}',
          analysis: quoteText,
          estimatedPrice
        };
        
        await addQuoteToSheet(quoteData);
        console.log('Quote added to Google Sheet successfully');
      } else {
        console.log('Google Sheet ID not configured, skipping sheet update');
      }
    } catch (sheetError) {
      console.error('Error adding quote to Google Sheet:', sheetError);
      // Continue with the response even if Google Sheets fails
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving quote:', error);
    res.status(500).json({ error: 'Failed to save quote' });
  }
});

// API endpoint for uploading videos to local storage
app.post('/api/upload-video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    
    const { quoteId } = req.body;
    
    if (!quoteId) {
      return res.status(400).json({ error: 'Quote ID is required' });
    }
    
    // Get the video URL from local storage
    const videoUrl = `/uploads/videos/${req.file.filename}`;
    
    console.log(`Video uploaded successfully for quote ${quoteId}. URL: ${videoUrl}`);
    
    // Update the quote with the video URL
    db.updateVideoUrl(quoteId, videoUrl);
    
    res.json({ 
      success: true, 
      videoUrl,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for retrieving all quotes
app.get('/api/quotes', async (req, res) => {
  try {
    const quotes = db.getAllQuotes();
    res.json({ quotes });
  } catch (error) {
    console.error('Error retrieving quotes:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for retrieving a specific quote
app.get('/api/quotes/:id', async (req, res) => {
  try {
    const quoteId = req.params.id;
    const quote = db.getQuoteById(quoteId);
    const userInfo = db.getUserByQuoteId(quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json({ 
      quote,
      userInfo
    });
  } catch (error) {
    console.error('Error retrieving quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for deleting a quote
app.delete('/api/quotes/:id', async (req, res) => {
  try {
    const quoteId = req.params.id;
    
    // Check if quote exists
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Delete the quote and associated user info
    const result = db.deleteQuote(quoteId);
    
    // Delete the video file if it exists
    if (quote.video_url) {
      const videoPath = quote.video_url.replace('/uploads/videos/', '');
      const fullPath = path.join(__dirname, '..', 'uploads', 'videos', videoPath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted video file: ${fullPath}`);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Quote ${quoteId} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for updating quote text
app.put('/api/quotes/:id/text', express.json(), async (req, res) => {
  try {
    const quoteId = req.params.id;
    const { quoteText } = req.body;
    
    if (!quoteText) {
      return res.status(400).json({ error: 'Quote text is required' });
    }
    
    // Check if quote exists
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Update the quote text
    db.updateQuoteText(quoteId, quoteText);
    
    res.json({ 
      success: true, 
      message: `Quote ${quoteId} updated successfully`
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for updating user information
app.put('/api/quotes/:id/user', express.json(), async (req, res) => {
  try {
    const quoteId = req.params.id;
    const { userInfo } = req.body;
    
    if (!userInfo) {
      return res.status(400).json({ error: 'User information is required' });
    }
    
    // Check if quote exists
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Check if user info exists
    const existingUserInfo = db.getUserByQuoteId(quoteId);
    if (!existingUserInfo) {
      return res.status(404).json({ error: 'User information not found' });
    }
    
    // Update the user information
    db.updateUserInfo(quoteId, userInfo);
    
    res.json({ 
      success: true, 
      message: `User information for quote ${quoteId} updated successfully`
    });
  } catch (error) {
    console.error('Error updating user information:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a test route to verify the server is working
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'test.html'));
});

// Handle React routing in production, return all requests to React app
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    console.log('Serving index.html for path:', req.path);
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
