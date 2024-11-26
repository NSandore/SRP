# Project Overview

This is a full-stack project with a PHP backend and React frontend.

## Structure

```
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
```

## Setup

### Backend
1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Run the PHP server:
   ```bash
   php -S localhost:8000 -t .
   ```

### Frontend
1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

---

### License
MIT
