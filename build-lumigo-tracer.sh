#!/bin/bash

echo "🔨 Building Enhanced Lumigo Tracer..."

# Navigate to lumigo-node directory
cd lumigo-node

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "⚡ Compiling TypeScript to JavaScript..."
npx tsc --build --force

echo "🔄 Converting ES6 modules to CommonJS..."
npx babel dist --out-dir dist --extensions .js --source-maps

echo "✅ Build complete! Enhanced tracer ready in lumigo-node/dist/"

# Copy the built tracer to the deployment directory
echo "📁 Copying built tracer to deployment directory..."
cp -r dist ../deployment/eventProcessor-deploy/lumigo-node/

echo "🚀 Enhanced Lumigo tracer built and deployed successfully!"
