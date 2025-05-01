# Deploying QuickQuote to Render.com

This guide provides step-by-step instructions for deploying the QuickQuote application to Render.com's free tier.

## Step 1: Create a Render.com Account

1. Go to [Render.com](https://render.com) and sign up for a free account
2. Verify your email address

## Step 2: Create a New Web Service

1. Log in to your Render.com dashboard
2. Click the "New +" button in the top right corner
3. Select "Web Service" from the dropdown menu

## Step 3: Connect to GitHub (Recommended Method)

### Option A: Deploy via GitHub
1. Select "Build and deploy from a Git repository"
2. Connect your GitHub account if not already connected
3. Find and select your repository

### Option B: Deploy via Manual Upload
1. Select "Upload Files"
2. Compress your project folder (excluding node_modules)
3. Upload the zip file to Render

## Step 4: Configure Your Web Service

Fill in the following details:
- **Name**: quickquote (or your preferred name)
- **Environment**: Node
- **Region**: Choose the closest to your users
- **Branch**: main (or your default branch)
- **Build Command**: `chmod +x render-build.sh && ./render-build.sh`
- **Start Command**: `npm run start-prod`

## Step 5: Add Environment Variables

Add the following environment variables:
1. Click on "Environment" section
2. Add the following key-value pairs:
   - `NODE_ENV`: production
   - `OPENAI_API_KEY`: your_openai_api_key
   - `PORT`: 10000

## Step 6: Set Up Persistent Disk

1. Click on "Disks" section
2. Add a new disk with the following settings:
   - **Name**: data
   - **Mount Path**: /opt/render/project/src/uploads
   - **Size**: 1 GB (minimum for free tier)

## Step 7: Deploy Your Application

1. Click "Create Web Service"
2. Wait for the deployment to complete (this may take a few minutes)
3. Once deployed, Render will provide a URL like `https://quickquote.onrender.com`

## Step 8: Test Your Deployment

1. Visit the provided URL in your browser
2. Test the video upload and quote generation functionality
3. Test the admin portal by visiting `/admin` on your deployed application

## Troubleshooting

If you encounter any issues:
1. Check the logs in the Render dashboard
2. Ensure all environment variables are set correctly
3. Verify that the persistent disk is mounted correctly
4. Check that the OpenAI API key is valid

## Free Tier Limitations

- The free tier on Render has limited compute resources
- Your service will spin down after 15 minutes of inactivity
- The first request after inactivity may take a few seconds to respond
- You get 750 hours of free usage per month

For production use with higher traffic, consider upgrading to a paid plan on Render.com.
