#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define the base project directory
BASE_DIR="/var/www/html/SRP"

# Create the base project directory if it doesn't exist
mkdir -p "$BASE_DIR"

# Change ownership to the current user (assumes script is run as 'nick')
chown -R "$USER":"$USER" "$BASE_DIR"

# Navigate to the base directory
cd "$BASE_DIR"

# Create frontend and backend directories
mkdir -p frontend
mkdir -p backend

# Navigate to backend directory to set up Laravel
cd backend

# Initialize a fresh Laravel project using Composer
composer create-project laravel/laravel . --no-interaction

# Set correct permissions for storage and bootstrap/cache
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

# Navigate back to the base directory
cd "$BASE_DIR"

# Set up frontend with React
cd frontend

# Initialize a new React app using Create React App
npx create-react-app .

# Install additional frontend dependencies
npm install axios react-router-dom

# Create necessary frontend directories
mkdir -p src/components src/hooks src/pages src/__tests__ src/styles
mkdir -p public/assets/css public/assets/js public/assets/images
mkdir -p public/uploads/profile_pictures

# Create a basic .gitignore in the frontend directory (optional, as Create React App already includes one)
cat > .gitignore <<EOL
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

node_modules
build
.env
EOL

# Navigate back to the base directory
cd "$BASE_DIR"

# Create a basic README.md in the base project directory (if not already created)
if [ ! -f README.md ]; then
    cat > README.md <<EOL
# SRP Project

This project is an online platform designed to assist prospective and existing students across the United States. It aims to foster a supportive community by providing resources, facilitating communication, and offering tools to make education more accessible and engaging.

## Directory Structure

- **frontend/**: React.js frontend application.
- **backend/**: Laravel backend application.
- **config/**: Configuration files, including database connections.
- **public/**: Public assets and entry points.
- **systemd/**: Systemd service files.
- **README.md**: Project documentation.
- **.gitignore**: Git ignore rules.

## Setup Instructions

1. **Frontend Setup:**
   - Navigate to the frontend directory:
     ```bash
     cd frontend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the development server:
     ```bash
     npm start
     ```

2. **Backend Setup:**
   - Navigate to the backend directory:
     ```bash
     cd backend
     ```
   - Install dependencies:
     ```bash
     composer install
     ```
   - Generate application key:
     ```bash
     php artisan key:generate
     ```
   - Configure environment variables in `backend/.env`.
   - Run migrations:
     ```bash
     php artisan migrate
     ```

## License

Specify your project's license here.
EOL
fi

# Create a basic .gitignore in the base project directory (optional, as needed)
if [ ! -f .gitignore ]; then
    cat > .gitignore <<EOL
# Laravel
/backend/vendor
/frontend/node_modules/

# Build outputs
/frontend/build/
public/assets/

# Environment files
/frontend/.env
/backend/.env

# Logs
/backend/storage/logs/
EOL
fi

# Initialize Git repository
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit with Laravel backend and React frontend setup"
fi

# Install 'tree' if not already installed
if ! command -v tree &> /dev/null
then
    echo "'tree' command not found. Installing..."
    sudo apt update
    sudo apt install tree -y
fi

# Display the created directory structure
echo "Project directories and files have been successfully created."
echo "Here's the created directory structure:"
tree "$BASE_DIR" -L 3
