const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Check if OpenAI API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.error('WARNING: OPENAI_API_KEY environment variable is not set. API calls will fail.');
}

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for image uploads (memory storage for OpenAI processing)
const imageStorage = multer.memoryStorage();
const imageUpload = multer({ storage: imageStorage });

// API endpoint for analyzing images
app.post('/api/analyze-images', imageUpload.array('images', 50), async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key is not configured. Please add it to your environment variables.',
        missingApiKey: true
      });
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images were uploaded' });
    }

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
    
    // Provide more specific error messages
    if (error.message.includes('API key')) {
      res.status(500).json({ 
        error: 'Invalid or missing OpenAI API key. Please check your environment variables.',
        missingApiKey: true
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Export the serverless function
module.exports.handler = serverless(app);
