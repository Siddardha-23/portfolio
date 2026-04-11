# DevOps Portfolio

A full-stack portfolio website showcasing DevOps and Cloud Engineering skills, built with a microservices backend deployed on AWS using Infrastructure as Code.

[![Deploy to AWS](https://github.com/Siddardha-23/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/Siddardha-23/portfolio/actions/workflows/deploy.yml)

## Live Demo

- **Website**: [manneharshithsiddardha.com](https://manneharshithsiddardha.com)
- **API Health**: [/api/health](https://manneharshithsiddardha.com/api/health)

## Architecture

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                        AWS Cloud                         │
                          │                                                          │
  User ──▶ Route 53 ──▶  │   CloudFront (CDN)                                      │
                          │     │                                                    │
                          │     ├── Static Assets ──▶ S3 Bucket (React Frontend)    │
                          │     │                                                    │
                          │     └── /api/* ──▶ API Gateway (HTTP API)               │
                          │                      │                                   │
                          │          ┌───────────┼───────────────────┐               │
                          │          │           │                   │               │
                          │          ▼           ▼                   ▼               │
                          │   ┌──────────┐ ┌──────────┐      ┌──────────┐          │
                          │   │ visitor  │ │   auth   │ ...  │  infra   │          │
                          │   │ Lambda   │ │  Lambda  │      │  Lambda  │          │
                          │   └────┬─────┘ └────┬─────┘      └────┬─────┘          │
                          │        │             │                 │                 │
                          │        └─────────────┴────┬────────────┘                │
                          │                           │                              │
                          │              ┌────────────┴────────────┐                │
                          │              │  Shared Lambda Layer    │                │
                          │              │  (utils, models, deps)  │                │
                          │              └─────────────────────────┘                │
                          │                                                          │
                          │   SSM Parameter Store (Secrets)    X-Ray (Tracing)      │
                          └──────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                                        MongoDB Atlas (DB)
```

### 5 Microservices

| Service | Lambda | Routes | Description |
|---------|--------|--------|-------------|
| **visitor** | `portfolio-visitor` | `/api/info`, `/api/session`, `/api/geo`, `/api/contact` | Visitor tracking, session analytics, IP geolocation, contact form |
| **auth** | `portfolio-auth` | `/api/auth` | User registration, login, JWT token management |
| **jobs-resume** | `portfolio-jobs-resume` | `/api/jobs`, `/api/resume` | Job search (JSearch API), AI resume tailoring, ATS scoring, PDF/DOCX generation |
| **chat** | `portfolio-chat` | `/api/chat` | AI chatbot powered by Google Gemini |
| **infra** | `portfolio-infra` | `/api/infra`, `/api/trace` | AWS cost tracking, health checks, X-Ray distributed tracing |

All services share a **Lambda Layer** (common utils, models, dependencies) and connect to the same **MongoDB Atlas** database. JWT auth is stateless — each service verifies tokens independently using the same secret from SSM.

## Key Features

- **AI-Powered Resume Tailoring** — Gemini AI parses resumes, tailors them against job descriptions, calculates ATS scores, and generates optimized PDFs
- **Interactive Cloud Lab** — Edge CDN latency tester, infrastructure cost calculator, security header scorecard, health dashboard
- **End-to-End Request Tracing** — AWS X-Ray visualization with API request waterfall charts rendered on the frontend
- **3D Visitor Analytics Globe** — Interactive 3D globe showing live visitor traffic, IP geolocations, and organizations
- **Project Sandbox CI/CD** — Interactive terminal simulating code changes, commits, and multi-stage pipeline execution
- **"Under the Hood" Mode** — Real-time architectural insights toggleable across the site
- **DevOps Easter Egg** — Hidden "Deploy Runner" game triggered by the Konami Code

## Project Structure

```
portfolio/
├── portfolio-frontend/          # React + TypeScript + Vite
│   ├── src/
│   └── package.json
│
├── portfolio-backend/           # Flask microservices
│   ├── local.py                 # Local dev gateway (all services, one port)
│   ├── requirements.txt         # All Python dependencies
│   ├── .env                     # Environment variables (local)
│   ├── shared/                  # Lambda Layer source
│   │   └── python/
│   │       ├── utils/           # config, db, security, SSM
│   │       └── models/          # user, visitor models
│   └── services/
│       ├── visitor/             # info, session, geo, contact blueprints
│       ├── auth/                # auth blueprint
│       ├── jobs-resume/         # jobs, resume blueprints + 11 services
│       ├── chat/                # chat blueprint + chat_service
│       └── infra/               # infra, trace blueprints
│
├── infrastructure/
│   └── terraform/               # All AWS resources (Lambda, API GW, CloudFront, S3, SSM, IAM)
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD: layer + 5 services + frontend (matrix deploy)
│
└── scripts/
```

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Three.js (3D globe)
- React Query

### Backend
- Python 3.12 + Flask 3.1
- MongoDB Atlas (pymongo)
- JWT auth (flask-jwt-extended) + bcrypt
- Google Gemini AI (google-genai)
- AWS X-Ray SDK

### Infrastructure
- **Compute**: 5 AWS Lambda functions + 1 shared Lambda Layer
- **API**: API Gateway HTTP API with per-service routing
- **CDN**: CloudFront + S3
- **DNS/SSL**: Route 53 + ACM
- **Secrets**: SSM Parameter Store (KMS encrypted)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions (matrix strategy for parallel deploys)

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)

### Quick Start (Makefile)

If you have `make` installed, you can easily manage the project setup and execution from the root directory:

```bash
# Install both frontend and backend dependencies
make install

# Start both servers simultaneously in new terminal windows
make run

# Run formatters and linters (eslint, black, flake8)
make format
make lint
```

### Backend

```bash
cd portfolio-backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python local.py
# All API endpoints at http://localhost:5000/api/*
```

`local.py` runs all 5 microservices as a single Flask app using Python namespace packages — no extra config needed.

### Frontend

```bash
cd portfolio-frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Environment Variables

Create `portfolio-backend/.env`:
```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/
DB_NAME=portfolio_db
JWT_SECRET_KEY=<your-secret>
IPINFO_TOKEN=<ipinfo-token>
GEMINI_API_KEY=<gemini-key>
JSEARCH_API_KEY=<jsearch-key>
JOB_SEARCH_PASSWORD_HASH=<bcrypt-hash>
GITHUB_PAT=<github-pat>
```

## Deployment

### Prerequisites

1. AWS CLI configured with credentials
2. Terraform >= 1.0
3. Node.js >= 18
4. Python >= 3.12

### Quick Deploy

```bash
# 1. Clone and configure
git clone https://github.com/Siddardha-23/portfolio.git
cd portfolio/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 2. Deploy infrastructure
terraform init
terraform apply

# 3. Push to trigger CI/CD
git push origin main
```

### CI/CD Pipeline

The GitHub Actions workflow on push to `main`:

1. **deploy-layer** — Builds shared Lambda Layer (utils, models, common deps)
2. **test-backend** — Smoke tests each service's Flask app
3. **deploy-services** — Matrix deploys all 5 Lambda functions in parallel
4. **deploy-frontend** — Builds React app, syncs to S3, invalidates CloudFront
5. **verify** — Health check on production

## Cost

Estimated monthly: **$2-5**

| Service | Cost |
|---------|------|
| S3 | ~$0.50 |
| CloudFront | ~$1-2 |
| Lambda (5 functions) | Free tier |
| API Gateway | Free tier |
| Route 53 | ~$0.50 |

## Author

**Harshith Siddardha Manne**
- LinkedIn: [linkedin.com/in/harshith-siddardha](https://linkedin.com/in/harshith-siddardha)
- GitHub: [github.com/Siddardha-23](https://github.com/Siddardha-23)
- Email: harshith.siddardha@gmail.com

## License

MIT License - feel free to use this as a template for your own portfolio!
