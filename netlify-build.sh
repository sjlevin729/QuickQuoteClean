#!/bin/bash

# Exit on error
set -e

# Install dependencies
npm install

# Install serverless-http if not already installed
if ! grep -q "serverless-http" package.json; then
  npm install --save serverless-http
fi

# Build the React app
npm run build

echo "Build completed successfully!"
