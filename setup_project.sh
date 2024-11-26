#!/bin/bash

# Project root directory
PROJECT_ROOT="project-root"

# Create directories
mkdir -p $PROJECT_ROOT/{backend/{api,db,lib,uploads},frontend/{public,src/{components,pages,styles}}}

# Create placeholder files
touch $PROJECT_ROOT/backend/{config.php,index.php}
touch $PROJECT_ROOT/backend/api/.gitkeep
touch $PROJECT_ROOT/backend/db/.gitkeep
touch $PROJECT_ROOT/backend/lib/.gitkeep
touch $PROJECT_ROOT/backend/uploads/.gitkeep
touch $PROJECT_ROOT/frontend/src/{App.js,index.js}
touch $PROJECT_ROOT/frontend/public/index.html
touch $PROJECT_ROOT/frontend/package.json
touch $PROJECT_ROOT/README.md

# Add README content
cat <<EOL > $PROJECT_ROOT/README.md
# Project Overview

This is a full-stack project with a PHP backend and React frontend.

## Structure

\`\`\`
project-root/
├── backend/          # PHP backend
│   ├── api/          # API endpoint scripts
│   ├── db/           # Database setup and scripts
│   ├── lib/          # Helper functions
│   ├── uploads/      # For user-uploaded files
│   ├── config.php    # Database connection settings
│   └── index.php     # Main entry point for API
├── frontend/         # React frontend
│   ├── public/       # Static files, index.html
│   ├── src/          # React source files
│   │   ├── components/ # Reusable components
│   │   ├── pages/       # Application pages
│   │   ├── styles/      # CSS or styling files
│   │   ├── App.js       # Main React component
│   │   └── index.js     # React entry point
│   └── package.json    # Frontend dependencies
└── README.md          # Documentation
\`\`\`

## Setup

### Backend
1. Navigate to \`backend\`:
   \`\`\`bash
   cd backend
   \`\`\`
2. Run the PHP server:
   \`\`\`bash
   php -S localhost:8000 -t .
   \`\`\`

### Frontend
1. Navigate to \`frontend\`:
   \`\`\`bash
   cd frontend
   \`\`\`
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Start the development server:
   \`\`\`bash
   npm start
   \`\`\`

---

### License
MIT
EOL

# Initialize placeholders with basic content
echo "<?php
// Database connection settings
return [
    'host' => 'localhost',
    'dbname' => 'example_db',
    'username' => 'root',
    'password' => '',
    'charset' => 'utf8mb4',
];" > $PROJECT_ROOT/backend/config.php

echo "<?php
// Main API entry point
echo 'API is working!';
?>" > $PROJECT_ROOT/backend/index.php

echo "<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>React App</title>
</head>
<body>
    <div id=\"root\"></div>
</body>
</html>" > $PROJECT_ROOT/frontend/public/index.html

echo "{
  \"name\": \"frontend\",
  \"version\": \"1.0.0\",
  \"scripts\": {
    \"start\": \"react-scripts start\",
    \"build\": \"react-scripts build\",
    \"test\": \"react-scripts test\",
    \"eject\": \"react-scripts eject\"
  },
  \"dependencies\": {
    \"react\": \"^18.0.0\",
    \"react-dom\": \"^18.0.0\",
    \"react-scripts\": \"5.0.0\"
  }
}" > $PROJECT_ROOT/frontend/package.json

echo "import React from 'react';

function App() {
    return (
        <div className=\"App\">
            <h1>Welcome to the Project</h1>
        </div>
    );
}

export default App;" > $PROJECT_ROOT/frontend/src/App.js

echo "import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
);" > $PROJECT_ROOT/frontend/src/index.js

# Output success message
echo "Project structure created successfully in $PROJECT_ROOT"
