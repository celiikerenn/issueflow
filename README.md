# IssueFlow

A project and issue tracking REST API built with Django REST Framework.

IssueFlow provides authenticated project management and issue tracking, with role-based project membership and automated API tests.

## Features

- JWT authentication with access and refresh tokens
- User registration and authenticated profile endpoint
- Project creation, listing, updating, and deletion
- Project membership with Admin and Member roles
- Issue creation, listing, updating, and deletion
- Issue statuses: To Do, In Progress, Done
- Issue priorities: Low, Medium, High, Critical
- Access control for project members
- Automated API tests

## Tech Stack

- Python
- Django
- Django REST Framework
- Simple JWT
- SQLite
- Git and GitHub

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/celiikerenn/issueflow.git
cd issueflow
```

### 2. Create and activate a virtual environment

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
python -m pip install -r backend/requirements.txt
```

### 4. Run database migrations

```powershell
cd backend
python manage.py migrate
```

### 5. Start the development server

```powershell
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health/` | Health check |
| POST | `/api/v1/auth/register/` | Register a user |
| POST | `/api/v1/auth/token/` | Obtain JWT tokens |
| POST | `/api/v1/auth/token/refresh/` | Refresh an access token |
| GET | `/api/v1/auth/me/` | Get the authenticated user's profile |
| GET, POST | `/api/v1/projects/` | List and create projects |
| GET, PATCH, PUT, DELETE | `/api/v1/projects/<id>/` | Retrieve, update, or delete a project |
| GET, POST | `/api/v1/projects/issues/` | List and create issues |
| GET, PATCH, PUT, DELETE | `/api/v1/projects/issues/<id>/` | Retrieve, update, or delete an issue |

Authenticated endpoints require the following header:

```http
Authorization: Bearer <access_token>
```

## Running Tests

From the `backend` directory:

```powershell
python manage.py test accounts
python manage.py test projects
```

## Project Status

Backend development is in progress. The next milestone is a React frontend for authentication, project management, and issue tracking.

## Author

Eren Çelik

[GitHub Repository](https://github.com/celiikerenn/issueflow)
