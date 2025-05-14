#!/bin/bash

echo "🚀 Starting deployment process for DApps Game..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install
npm install gh-pages --save-dev

# Build and deploy to GitHub Pages
echo "🔨 Building and deploying to GitHub Pages..."
npm run deploy

echo "✅ Deployment complete! Your app will be available at https://nhatminh37.github.io/dapps-game"
echo "Note: It might take a few minutes for the GitHub Pages site to update." 