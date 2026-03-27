# Portfolio Backend

Microservices-based Flask backend deployed as independent AWS Lambda functions behind API Gateway.

## Architecture

```
portfolio-backend/
  local.py                    # Local dev gateway (runs all services on port 5000)
  requirements.txt            # All dependencies for local development
  .env                        # Environment variables (local only)

  shared/                     # Lambda Layer — shared code across all services
    python/
      utils/
        config.py             # Configuration (SSM + env var fallback)
        db_connect.py         # MongoDB connection manager
        security.py           # Input sanitization, rate limiting
        ssm_config.py         # AWS SSM Parameter Store integration
      models/
        user.py               # User model (bcrypt auth)
        visitor.py            # Visitor data models

  services/
    visitor/                  # Visitor tracking, analytics, geolocation, contact
      app.py
      lambda_handler.py
      blueprints/
        info.py               # POST /api/info, GET /api/info/visitors, etc.
        session.py            # POST /api/session/validate, track-page, track-time
        geolocation.py        # POST /api/geo/lookup, GET /api/geo/my-ip
        contact.py            # POST /api/contact, GET /api/contact/messages
      services/
        visitor_service.py
        session_service.py
        ip_service.py
        linkedin_service.py

    auth/                     # Authentication and JWT token management
      app.py
      lambda_handler.py
      blueprints/
        auth.py               # POST /api/auth/register, /login, GET /profile, /verify

    jobs-resume/              # Job search and resume tailoring (async processing)
      app.py
      lambda_handler.py       # Includes async_job dispatch for background processing
      blueprints/
        jobs.py               # POST /api/jobs/auth, GET /search, POST /batch-search, saved jobs
        resume.py             # POST /api/resume/extract-jd, /tailor, /ats-scores, /download
      services/
        job_service.py
        resume_service.py     # Async job orchestrator (Lambda self-invocation)
        resume_parser.py
        resume_tailor.py
        resume_scorer.py
        resume_renderer.py    # PDF/DOCX generation
        keyword_gap_engine.py
        impact_engine.py
        integrity_guard.py
        project_generator.py
        gemini_client.py
      schemas/
        resume_schemas.py

    chat/                     # AI chatbot powered by Google Gemini
      app.py
      lambda_handler.py
      blueprints/
        chat.py               # POST /api/chat
      services/
        chat_service.py

    infra/                    # Infrastructure insights and distributed tracing
      app.py
      lambda_handler.py
      blueprints/
        infra.py              # GET /api/infra/costs, /health, POST /match
        trace.py              # GET /api/trace, /pageload
```

## Services

| Service | Lambda | Port (local) | Description |
|---------|--------|-------------|-------------|
| **visitor** | `portfolio-visitor` | 5000 | Visitor tracking, session analytics, IP geolocation, contact form |
| **auth** | `portfolio-auth` | 5000 | User registration, login, JWT token issuance |
| **jobs-resume** | `portfolio-jobs-resume` | 5000 | Job search (JSearch API), resume tailoring, ATS scoring, PDF/DOCX generation |
| **chat** | `portfolio-chat` | 5000 | AI chatbot with Gemini, portfolio-aware responses |
| **infra** | `portfolio-infra` | 5000 | AWS cost tracking, health checks, X-Ray distributed tracing |

All services share the same MongoDB Atlas database. JWT verification is stateless — each service that needs it uses the same `JWT_SECRET_KEY` from SSM.

## Tech Stack

- **Runtime**: Python 3.12, Flask 3.1
- **Database**: MongoDB Atlas (pymongo)
- **Auth**: JWT (flask-jwt-extended), bcrypt password hashing
- **AI**: Google Gemini (google-genai)
- **Cloud**: AWS Lambda, API Gateway (HTTP API), CloudFront, S3
- **IaC**: Terraform
- **CI/CD**: GitHub Actions (matrix deploy)
- **Observability**: AWS X-Ray, CloudWatch

## Local Development

### Prerequisites

- Python 3.12+
- MongoDB Atlas cluster (or local MongoDB)
- pip

### Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables — create `.env` in the backend root:
```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/?appName=Cluster0
DB_NAME=portfolio_db
JWT_SECRET_KEY=<your-secret>
IPINFO_TOKEN=<ipinfo-token>
GEMINI_API_KEY=<gemini-key>
JSEARCH_API_KEY=<jsearch-key>
JOB_SEARCH_PASSWORD_HASH=<bcrypt-hash>
GITHUB_PAT=<github-pat>
```

### Running

```bash
python local.py
```

This starts a single Flask process on `http://localhost:5000` with **all** service blueprints registered. The `local.py` gateway uses Python namespace packages to import from every service directory — no special setup needed.

All endpoints are available at their normal paths:
- `http://localhost:5000/api/health` — health check
- `http://localhost:5000/api/auth/login` — auth
- `http://localhost:5000/api/chat` — chat
- `http://localhost:5000/api/jobs/search?q=...` — job search
- etc.

### How local.py works

1. Adds `shared/python/` to `sys.path` (for utils, models)
2. Adds each `services/<name>/` to `sys.path`
3. Python namespace packages let `from blueprints.info import info_bp` resolve to the correct file across all service directories (no `__init__.py` needed)
4. All blueprints are registered on a single Flask app
5. `.env` is loaded from the backend root

## AWS Deployment

### Infrastructure (Terraform)

Located in `infrastructure/terraform/`:

- **5 Lambda functions** — one per service, each with its own memory/timeout config
- **1 Lambda Layer** — shared code (utils, models, common dependencies)
- **API Gateway HTTP API** — specific routes per service (no catch-all)
- **SSM Parameter Store** — all secrets (encrypted with KMS)
- **CloudFront** — CDN for frontend + API routing
- **S3** — frontend static assets
- **X-Ray** — distributed tracing on all services

### API Gateway Routing

| Route | Lambda |
|-------|--------|
| `POST /api/info`, `ANY /api/info/{proxy+}` | visitor |
| `ANY /api/session/{proxy+}` | visitor |
| `ANY /api/geo/{proxy+}` | visitor |
| `POST /api/contact`, `ANY /api/contact/{proxy+}` | visitor |
| `GET /api/health` | visitor |
| `ANY /api/auth/{proxy+}` | auth |
| `ANY /api/jobs/{proxy+}` | jobs-resume |
| `ANY /api/resume/{proxy+}` | jobs-resume |
| `POST /api/chat`, `ANY /api/chat/{proxy+}` | chat |
| `ANY /api/infra/{proxy+}` | infra |
| `GET /api/trace`, `ANY /api/trace/{proxy+}` | infra |

### CI/CD (GitHub Actions)

The `deploy.yml` workflow:

1. **deploy-layer** — builds and publishes the shared Lambda Layer
2. **test-backend** — smoke tests each service's Flask app
3. **deploy-services** — matrix strategy deploys all 5 services in parallel
4. **deploy-frontend** — builds React app, syncs to S3, invalidates CloudFront
5. **verify** — hits `/api/health` to confirm deployment

### Secrets (SSM)

Each Lambda only receives the SSM parameter paths it needs:

| Service | Secrets |
|---------|---------|
| visitor | MONGODB_URI, IPINFO_TOKEN, JWT_SECRET_KEY |
| auth | MONGODB_URI, JWT_SECRET_KEY |
| jobs-resume | MONGODB_URI, JWT_SECRET_KEY, JSEARCH_API_KEY, JOB_SEARCH_PASSWORD_HASH, GEMINI_API_KEY |
| chat | MONGODB_URI, GEMINI_API_KEY |
| infra | MONGODB_URI, GITHUB_PAT |

## API Endpoints

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | - | Register new user |
| POST | /login | - | Login, get JWT |
| GET | /profile | JWT | Get user profile |
| GET | /verify | JWT | Verify token |

### Visitor Info (`/api/info`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | - | Track visitor |
| GET | /visitors | - | Visitor stats |
| GET | /countries | - | Geographic distribution |
| POST | /register | - | Register with LinkedIn |
| GET | /registered | JWT | List registered visitors |

### Contact (`/api/contact`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | - | Submit message |
| GET | /messages | JWT | Get all messages |

### Session (`/api/session`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /validate | - | Create/validate session |
| POST | /track-page | - | Track page view |
| POST | /track-time | - | Track section time |
| GET | /section-analytics | - | Public analytics |
| GET | /stats | JWT | Session stats |

### Geolocation (`/api/geo`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /lookup | - | IP geolocation |
| GET | /my-ip | - | Get visitor IP |
| GET | /stats | JWT | IP statistics |

### Chat (`/api/chat`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | - | Chat with AI assistant |

### Jobs (`/api/jobs`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth | - | Password gate (24h JWT) |
| GET | /search | JWT | Search jobs |
| POST | /batch-search | JWT | Batch search (up to 8 queries) |
| GET | /saved | JWT | Get saved jobs |
| POST | /save | JWT | Save a job |
| DELETE | /save/:id | JWT | Delete saved job |

### Resume (`/api/resume`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /extract-jd | JWT | Extract JD (async) |
| POST | /tailor | JWT | Tailor resume (async) |
| POST | /ats-scores | JWT | ATS scoring (async) |
| GET | /job/:id | JWT | Poll job status |
| POST | /download | JWT | Generate PDF/DOCX |

### Trace (`/api/trace`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | - | Request waterfall |
| GET | /pageload | - | Page load trace |

### Infra (`/api/infra`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /costs | - | AWS costs |
| GET | /health | - | Infrastructure health |
| POST | /match | - | AI-powered JD matching |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | - | Health check |
