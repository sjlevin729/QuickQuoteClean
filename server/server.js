const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const db = require('./database/db');

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

// Configure multer for image uploads (memory storage for OpenAI processing)
const imageStorage = multer.memoryStorage();
const imageUpload = multer({ storage: imageStorage });

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

// API endpoint to analyze images
app.post('/api/analyze-images', imageUpload.array('images', 50), async (req, res) => {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return res.status(500).json({ error: 'OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.' });
    }

    // Check if images were uploaded
    if (!req.files || req.files.length === 0) {
      console.error('No images were uploaded');
      return res.status(400).json({ error: 'No images were uploaded.' });
    }

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

    console.log(`Sorted ${sortedImages.length} images for analysis`);
    
    // Limit the number of images to avoid exceeding API limits
    const maxImages = 10; // Reduce from 50 to 10 to avoid payload size issues
    const limitedImages = sortedImages.length > maxImages 
      ? sortedImages.filter((_, index) => index % Math.ceil(sortedImages.length / maxImages) === 0).slice(0, maxImages)
      : sortedImages;
    
    console.log(`Using ${limitedImages.length} images for API request (from ${sortedImages.length} total)`);

    // Prepare images for OpenAI API
    const imageContents = limitedImages.map(file => {
      // Convert the buffer to base64
      const base64Image = file.buffer.toString('base64');
      return {
        type: "image_url",
        image_url: {
          url: `data:${file.mimetype};base64,${base64Image}`
        }
      };
    });

    // Construct the prompt with cleaning context if provided
    let promptText = "You are a professional cleaning service estimator. Analyze these images of a space and provide a detailed cleaning quote. Include:";
    promptText += "\n1. A breakdown of all areas that need cleaning";
    promptText += "\n2. Specific cleaning tasks required for each area";
    promptText += "\n3. Estimated time for each task";
    promptText += "\n4. Materials and equipment needed";
    promptText += "\n5. Total cost estimate (in GBP £) with a breakdown";
    
    // Add cleaning context to the prompt if provided
    if (cleaningContext) {
      promptText += `\n\nAdditional context from the customer: ${cleaningContext}`;
      promptText += "\nPlease take this information into account when creating your quote.";
    }
    
    promptText += "\n\nFormat your response professionally as a cleaning quote with clear sections and pricing.";

    console.log('Sending request to OpenAI API...');
    
    // Call OpenAI API
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

    console.log('Received response from OpenAI API');

    // Generate a unique quote ID
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const quoteId = `QQ-${timestamp.toString().slice(-6)}-${randomStr}`;

    // Send the response back to the client
    res.json({ 
      analysis: response.choices[0].message.content,
      quoteId: quoteId
    });

  } catch (error) {
    console.error('Error analyzing images:', error);
    // Log more details about the error
    if (error.response) {
      console.error('OpenAI API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    res.status(500).json({ error: error.message || 'An error occurred during image analysis.' });
  }
});

// API endpoint for saving quotes
app.post('/api/save-quote', express.json(), async (req, res) => {
  try {
    const { quoteId, quoteText, userInfo } = req.body;
    
    // Validate all required fields are present
    if (!quoteId || !quoteText) {
      return res.status(400).json({ error: 'Quote ID and text are required' });
    }

    if (!userInfo || !userInfo.name || !userInfo.email || !userInfo.phone) {
      return res.status(400).json({ error: 'User information (name, email, phone) is required' });
    }
    
    // Save the quote to the database
    db.saveQuote(quoteId, quoteText);
    
    // Save user info
    db.saveUserInfo(quoteId, userInfo);
    
    res.json({ 
      success: true, 
      quoteId,
      message: 'Quote and user information saved successfully' 
    });
  } catch (error) {
    console.error('Error saving quote:', error);
    res.status(500).json({ error: error.message });
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
