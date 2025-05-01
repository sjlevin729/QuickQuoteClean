# QuickQuote - AI-Powered Cleaning Quote Generator

QuickQuote is a professional web application that allows users to upload videos of spaces and receive instant, AI-generated cleaning quotes. The application uses React for the frontend, Express for the backend, and integrates with OpenAI's Vision API for quote generation.

## Features

- **Video Upload**: Drag & drop or browse to upload a video of your space
- **AI Analysis**: Automatic extraction of frames and analysis by OpenAI Vision
- **Instant Quotes**: Receive detailed, itemized cleaning quotes with time estimates and costs
- **Professional UI**: Clean, responsive interface with loading animations
- **Admin Portal**: Manage quotes, edit customer information, and view uploaded videos
- **Database Integration**: SQLite database for storing quotes and customer information

## Tech Stack

- **Frontend**: React, Bootstrap, FFmpeg.wasm
- **Backend**: Express, SQLite (better-sqlite3)
- **AI Integration**: OpenAI Vision API (gpt-4o model)
- **Build Tools**: Webpack, Babel

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PORT=3001
   ```

## Running Locally

To run the application in development mode:

```
npm run dev
```

This will start both the React frontend and Express backend concurrently.

## Building for Production

To build the application for production:

```
npm run build
```

This will create a production build in the `dist` directory.

## Deployment to Render.com

This application is configured for easy deployment to Render.com's free tier:

1. Create a new account on [Render.com](https://render.com) if you don't have one
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository or use the "Deploy from GitHub" option
4. Configure the deployment:
   - **Name**: quickquote (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start-prod`
5. Add the following environment variables:
   - `NODE_ENV`: production
   - `OPENAI_API_KEY`: your OpenAI API key
   - `PORT`: 3000 (Render will override this with its own port)
6. Click "Create Web Service"

Render will automatically deploy your application and provide a URL like `https://quickquote.onrender.com`.

## Project Structure

- `/src`: React frontend code
- `/server`: Express backend code
- `/server/database`: SQLite database integration
- `/uploads`: Local storage for uploaded videos
- `/public`: Static assets

## Admin Portal

Access the admin portal by navigating to `/admin` on your deployed application. This allows you to:

- View all submitted quotes
- Edit quote text and customer information
- Delete quotes and associated videos
- View and share video URLs

## License

MIT
