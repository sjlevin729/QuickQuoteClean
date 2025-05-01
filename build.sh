#!/bin/bash

# Create necessary directories
mkdir -p dist
mkdir -p uploads/videos
mkdir -p data

# Build the application
npm run build

# Copy server files to dist
cp -r server dist/

# Ensure correct permissions
chmod -R 755 dist
chmod -R 755 uploads
chmod -R 755 data

echo "Build completed successfully!"
