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
     \\bash
     cd frontend
     \   - Install dependencies:
     \\bash
     npm install
     \
2. **Backend Setup:**
   - Navigate to the backend directory:
     \\bash
     cd backend
     \   - Install dependencies:
     \\bash
     composer install
     \
3. **Configure Environment Variables:**
   - Replace placeholders in \config/database.php\ with your actual database credentials.

4. **Run Migrations:**
   - Ensure your database is set up and run migrations:
     \\bash
     php artisan migrate
     \
5. **Start Services:**
   - Start the Laravel backend and React frontend as per your setup.

## License

Specify your project's license here.

