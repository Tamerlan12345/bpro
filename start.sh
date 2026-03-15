#!/bin/sh

# Ensure we are in the correct directory
cd "$(dirname "$0")/backend" || exit 1

# Function to check for command existence
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Try to find node
if ! command_exists node; then
    # Try sourcing NVM if present
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
        . "$HOME/.nvm/nvm.sh"
    elif [ -f "/usr/local/nvm/nvm.sh" ]; then
        . "/usr/local/nvm/nvm.sh"
    fi
fi

if ! command_exists node; then
    echo "Error: Node.js is required but not found in PATH."
    echo "Please ensure Node.js is installed."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Installing..."
    if [ -f "yarn.lock" ] && command_exists yarn; then
        yarn install
    else
        npm install
    fi
fi

# Start the application
echo "Starting application..."
node index.js
