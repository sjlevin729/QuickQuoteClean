#!/usr/bin/env bash
# Exit on error
set -o errexit

# Create necessary directories
mkdir -p uploads/videos
mkdir -p data

# Install dependencies
npm install

# Build the React app
npm run build

# Make sure the script is executable
chmod +x render-build.sh

echo "Build completed successfully!"
