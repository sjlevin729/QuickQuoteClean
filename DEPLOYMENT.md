# Deploying QuickQuote to Render.com

This guide will walk you through deploying the QuickQuote application to Render.com, which offers a free tier for web services.

## Prerequisites

1. A GitHub account
2. A Render.com account (sign up at https://render.com)
3. An OpenAI API key

## Step 1: Prepare Your Repository

1. Push your code to a GitHub repository.
2. Make sure your repository includes all the necessary files:
   - `package.json` with the correct scripts
   - `Procfile` with the web command
   - `render.yaml` for Render configuration
   - `.env.production` for production environment variables

## Step 2: Set Up the Web Service on Render

1. Log in to your Render.com account
2. Click on the "New +" button in the dashboard
3. Select "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: quickquote (or your preferred name)
   - **Environment**: Node
   - **Region**: Choose the closest to your users
   - **Branch**: main (or your default branch)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start-prod`

## Step 3: Configure Environment Variables

1. In the "Environment" section, add the following environment variables:
   - `NODE_ENV`: production
   - `OPENAI_API_KEY`: your OpenAI API key
   - `PORT`: 10000 (Render will override this with its own port)

## Step 4: Configure Persistent Disk

1. In the "Disks" section, add a new disk:
   - **Name**: data
   - **Mount Path**: /opt/render/project/src/uploads
   - **Size**: 1 GB (minimum for free tier)

## Step 5: Deploy the Service

1. Click "Create Web Service"
2. Wait for the deployment to complete (this may take a few minutes)
3. Once deployed, Render will provide a URL like `https://quickquote.onrender.com`

## Step 6: Verify the Deployment

1. Visit the provided URL to ensure the application is running correctly
2. Test the video upload and quote generation functionality
3. Test the admin portal by visiting `/admin` on your deployed application

## Troubleshooting

If you encounter any issues:

1. Check the logs in the Render dashboard
2. Ensure all environment variables are set correctly
3. Verify that the persistent disk is mounted correctly
4. Check that the OpenAI API key is valid

## Maintaining Your Deployment

- Render will automatically redeploy your application when you push changes to your GitHub repository
- You can manually trigger a deploy from the Render dashboard
- Monitor your usage to stay within the free tier limits

## Free Tier Limitations

- The free tier on Render has limited compute resources
- Your service will spin down after 15 minutes of inactivity
- The first request after inactivity may take a few seconds to respond
- You get 750 hours of free usage per month

For production use with higher traffic, consider upgrading to a paid plan on Render.com.
