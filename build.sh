#!/bin/bash
# This script runs during the build process

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install

# Build frontend
echo "Building frontend..."
cd ../frontend
npm install
npm run build

echo "Build completed successfully!"
