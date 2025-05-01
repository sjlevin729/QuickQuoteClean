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
app.use(express.static(path.join(__dirname, '..', 'public')));

// Add CORS headers for SharedArrayBuffer support
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

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

// API endpoint for analyzing images
app.post('/api/analyze-images', imageUpload.array('images', 50), async (req, res) => {
  try {
    // Sort images by name to ensure they're in the correct order
    const sortedImages = req.files.sort((a, b) => {
      const nameA = a.originalname;
      const nameB = b.originalname;
      return nameA.localeCompare(nameB);
    });

    // Prepare images for OpenAI API
    const imageContents = sortedImages.map(file => {
      // Convert buffer to base64
      const base64Image = file.buffer.toString('base64');
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Image}`
        }
      };
    });

    // Prompt for the OpenAI Vision model
    const prompt = `You are a professional cleaning service estimator. Analyze these sequential images of a space and provide a detailed cleaning quote.

Your response should have this structure:
1. A brief summary of the space (type of room, size, level of clutter) - be professional and tactful
2. An itemized list of cleaning tasks with estimated time for each task
3. Total time and cost calculation (at £15 per hour)

Do not format this as a letter - no greeting, client name placeholders, or sign-off.
Keep your response concise and focused on the cleaning assessment and quote.

If the images do not show a space that needs cleaning (e.g., it's not a room, office, or cleanable area), politely explain that you can only provide quotes for indoor spaces that require cleaning services.`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: imageContents
        }
      ],
      max_tokens: 1000,
    });

    // Send the analysis back to the client
    res.json({ analysis: response.choices[0].message.content });
  } catch (error) {
    console.error('Error analyzing images:', error);
    res.status(500).json({ error: error.message });
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

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  console.log('Serving static files from:', distPath);
  
  // Check if dist directory exists
  if (fs.existsSync(distPath)) {
    console.log('Dist directory exists');
    // Check if index.html exists
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log('index.html exists in dist directory');
      console.log('Contents of dist directory:');
      const files = fs.readdirSync(distPath);
      console.log(files);
    } else {
      console.log('WARNING: index.html does not exist in dist directory');
    }
  } else {
    console.log('WARNING: Dist directory does not exist');
    // Try to create it
    try {
      fs.mkdirSync(distPath, { recursive: true });
      console.log('Created dist directory');
    } catch (error) {
      console.error('Error creating dist directory:', error);
    }
  }
  
  // Serve static files
  app.use(express.static(distPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    console.log('Serving index.html for path:', req.path);
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      res.status(404).send('index.html not found in dist directory');
    }
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
