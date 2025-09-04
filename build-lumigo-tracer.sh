#!/bin/bash

echo "🔨 Building Enhanced Lumigo Tracer..."

# Navigate to src/lumigo-tracer directory
cd src/lumigo-tracer

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🧹 Cleaning previous build..."
rm -rf dist/

echo "⚡ Compiling TypeScript to JavaScript..."
npx tsc --build --force

echo "🔄 Converting ES6 modules to CommonJS with decorator support..."
npx babel dist --out-dir dist --extensions .js --source-maps

echo "✅ Build complete! Enhanced tracer ready in src/lumigo-tracer/dist/"

# Copy the built tracer to the build directory
echo "📁 Copying built tracer to build directory..."
mkdir -p ../../build/lumigo-node
cp -r dist/* ../../build/lumigo-node/
cp package.json ../../build/lumigo-node/

echo "🚀 Enhanced Lumigo tracer built successfully!"
