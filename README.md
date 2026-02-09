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

## 📁 Project Structure

```
portfolio/
├── .github/workflows/       # GitHub Actions CI/CD
│   └── deploy.yml
├── infrastructure/          # Infrastructure as Code
│   ├── terraform/          # AWS resources (S3, CloudFront, Lambda, etc.)
│   └── iam-policy.json     # IAM policy for deployment
├── portfolio-frontend/      # React/Vite frontend
│   ├── src/
│   └── package.json
├── portfolio-backend/       # Flask API backend
│   ├── blueprints/
│   ├── services/
│   └── requirements.txt
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Backend
- **Flask** (Python)
- **JWT** authentication
- **MongoDB** database

### Infrastructure (AWS)
- **S3** - Static website hosting
- **CloudFront** - Global CDN
- **Lambda** - Serverless compute
- **API Gateway** - REST API
- **Route 53** - DNS management
- **ACM** - SSL certificates
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
