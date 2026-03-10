# 🚀 DevOps Portfolio

A full-stack portfolio website showcasing DevOps and Cloud Engineering skills, deployed on AWS using Infrastructure as Code. |

[![Deploy to AWS](https://github.com/Siddardha-23/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/Siddardha-23/portfolio/actions/workflows/deploy.yml)

## 🌐 Live Demo

- **Website**: [manneharshithsiddardha.com](https://manneharshithsiddardha.com)
- **API Health**: [/api/health](https://manneharshithsiddardha.com/api/health)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│                                                                              │
│   ┌─────────────┐      ┌─────────────────────────────────────────────────┐  │
│   │  Route 53   │      │              CloudFront Distribution             │  │
│   │    DNS      │─────▶│                    (CDN)                         │  │
│   └─────────────┘      └─────────────┬───────────────────┬───────────────┘  │
│                                      │                   │                   │
│                            Static    │                   │    /api/*        │
│                            Assets    │                   │                   │
│                                      ▼                   ▼                   │
│                        ┌─────────────────┐    ┌─────────────────────────┐   │
│                        │   S3 Bucket     │    │   API Gateway → Lambda  │   │
│                        │   (Frontend)    │    │   (Flask Backend)       │   │
│                        └─────────────────┘    └───────────┬─────────────┘   │
│                                                           │                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    SSM Parameter Store (Secrets)                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │   MongoDB Atlas     │
                           │   (Free Tier)       │
                           └─────────────────────┘
```

## 🌟 Key Features

- **AI-Powered Resume Tailoring**: Integrated Gemini AI to parse resumes, tailor them against Job Descriptions, calculate ATS/screener scores, and dynamically generate optimized PDFs.
- **Interactive Cloud Lab**: Real-time cloud demonstrations including an Edge CDN Latency Tester, Infrastructure Cost Calculator, Security Header Scorecard, and Infrastructure Health Dashboard.
- **End-to-End Request Tracing**: Built-in AWS X-Ray visualization, rendering API request waterfall charts directly on the frontend.
- **3D Visitor Analytics Globe**: Interactive 3D globe visualizing live visitor traffic, IP geolocations, and organizations.
- **Seamless Serverless Backend**: Flask API wrapped with Mangum for scalable AWS Lambda execution with MongoDB Atlas caching and state management.

## 📁 Project Structure

```text
portfolio/
├── .github/workflows/       # GitHub Actions CI/CD
├── infrastructure/          # Terraform AWS resources
├── portfolio-frontend/      # React/Vite frontend (Cloud Lab, Globe, X-Ray UI)
├── portfolio-backend/       # Flask API (Gemini integrations, Mangum adapter)
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for analytics
- **Globe.gl** for 3D interactions

### Backend
- **Flask** (Python 3.12)
- **Mangum** (ASGI adapter for Lambda)
- **Gemini AI** (Generative AI integration)
- **PyPDF2 / fpdf2 / python-docx** for document processing
- **JWT** authentication
- **MongoDB Atlas** database

### Infrastructure (AWS)
- **S3 & CloudFront** - Static website & Global CDN
- **Lambda & API Gateway** - Serverless compute & REST API
- **AWS X-Ray** - End-to-end request tracing
- **Route 53 & ACM** - DNS & SSL certificates
- **SSM Parameter Store** - Secrets management

### DevOps
- **Terraform** - Infrastructure as Code
- **GitHub Actions** - CI/CD pipeline
- **Docker** - Containerization (optional)

## 🚀 Deployment

### Prerequisites

1. AWS CLI configured with credentials
2. Terraform >= 1.0
3. Node.js >= 18
4. Python >= 3.11

### Quick Deploy

```bash
# 1. Clone the repository
git clone https://github.com/Siddardha-23/portfolio.git
cd portfolio

# 2. Configure Terraform variables
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Deploy infrastructure
terraform init
terraform apply

# 4. Push to trigger CI/CD
git push origin main
```

### CI/CD Pipeline

The GitHub Actions workflow automatically:
1. ✅ Builds frontend and uploads to S3
2. ✅ Packages backend and deploys to Lambda
3. ✅ Invalidates CloudFront cache
4. ✅ Runs health checks

## 💰 Cost

Estimated monthly cost: **$2-5**

| Service | Cost |
|---------|------|
| S3 | ~$0.50 |
| CloudFront | ~$1-2 |
| Lambda | Free tier |
| API Gateway | Free tier |
| Route 53 | ~$0.50 |

## 🔧 Local Development

### Frontend
```bash
cd portfolio-frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Backend
```bash
cd portfolio-backend
python -m venv env
source env/bin/activate  # or `env\Scripts\activate` on Windows
pip install -r requirements.txt
python app.py
# API at http://localhost:5000
```

## 📄 License

MIT License - feel free to use this as a template for your own portfolio!

## 👤 Author

**Harshith Siddardha Manne**
- LinkedIn: [linkedin.com/in/harshith-siddardha](https://linkedin.com/in/harshith-siddardha)
- GitHub: [github.com/Siddardha-23](https://github.com/Siddardha-23)
- Email: harshith.siddardha@gmail.com
