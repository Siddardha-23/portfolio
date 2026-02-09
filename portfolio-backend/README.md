# Portfolio Backend

Flask backend application with authentication and visitor tracking.

## Features

- **Authentication**: Username/password authentication with JWT tokens
- **Visitor Tracking**: Store and track visitor information
- **Flask Blueprints**: Organized code structure with blueprints
- **Database**: MySQL database with connection pooling

## Setup

### Prerequisites

- Python 3.8+
- MySQL database
- pip

### Installation

1. Create a virtual environment:
```bash
python -m venv env
```

2. Activate the virtual environment:
```bash
# Windows
env\Scripts\activate

# Linux/Mac
source env/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update database credentials and JWT secret key

5. Set up the database:
   - Create a MySQL database (default: `master_db`)
   - The application will automatically create required tables on first run

### Running the Application

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/profile` - Get user profile (requires authentication)
- `GET /api/auth/verify` - Verify JWT token (requires authentication)

### Visitor Info

- `POST /api/info` - Store visitor information
- `GET /api/info/stats` - Get visitor statistics (requires authentication)

### Health Check

- `GET /api/health` - Health check endpoint

## Project Structure

```
portfolio-backend/
├── app.py                 # Application entry point
├── blueprints/            # Flask blueprints
│   ├── auth.py           # Authentication endpoints
│   └── info.py           # Visitor info endpoints
├── models/               # Data models
│   └── user.py           # User model
├── utils/                # Utility modules
│   ├── config.py         # Configuration
│   └── db_connect.py     # Database connection
└── requirements.txt      # Python dependencies
```

## Environment Variables

- `DB_HOST` - Database host (default: localhost)
- `DB_USER` - Database user (default: root)
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name (default: master_db)
- `JWT_SECRET_KEY` - Secret key for JWT tokens

## Notes

- The application uses JWT tokens for authentication
- Tokens expire after 24 hours
- Database tables are created automatically on first use
- All passwords are hashed using SHA-256 with salt
