# Portfolio Infrastructure Deployment

This directory contains the Infrastructure as Code (IaC) for deploying the portfolio to AWS using a serverless architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│                                                                              │
│   ┌─────────────┐      ┌─────────────────────────────────────────────────┐  │
│   │  Route 53   │      │              CloudFront Distribution             │  │
│   │    DNS      │─────▶│                                                  │  │
│   │             │      │   ┌─────────────┐     ┌─────────────────────┐   │  │
│   └─────────────┘      │   │  Origin 1   │     │      Origin 2       │   │  │
│                        │   │   S3 /*     │     │  API Gateway /api/* │   │  │
│                        │   └──────┬──────┘     └──────────┬──────────┘   │  │
│                        └──────────┼────────────────────────┼─────────────┘  │
│                                   │                        │                │
│                                   ▼                        ▼                │
│                        ┌─────────────────┐      ┌─────────────────────┐    │
│                        │   S3 Bucket     │      │   Lambda Function   │    │
│                        │   (Frontend)    │      │   (Flask Backend)   │    │
│                        │   React Build   │      │                     │    │
│                        └─────────────────┘      └──────────┬──────────┘    │
│                                                            │               │
└────────────────────────────────────────────────────────────┼───────────────┘
                                                             │
                                                             ▼
                                                  ┌─────────────────────┐
                                                  │   MongoDB Atlas     │
                                                  │   (Free Tier)       │
                                                  └─────────────────────┘
```

## Cost Breakdown (Estimated)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| **S3** | 5GB storage, 20K GET requests | ~$0.50/month |
| **CloudFront** | 1TB data transfer, 10M requests | ~$1-2/month |
| **Lambda** | 1M requests, 400K GB-seconds | ~$0 (likely under free tier) |
| **API Gateway** | 1M requests/month | ~$0 (likely under free tier) |
| **Route 53** | - | ~$0.50/month (hosted zone) |
| **ACM** | Free | $0 |
| **Total** | | **~$2-5/month** |

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Node.js** >= 18 for frontend build
4. **Python** 3.11 for backend packaging
5. **Domain** configured in Route 53 (already done)

## Quick Start

### 1. Configure Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual values:
```hcl
mongodb_uri    = "your-mongodb-atlas-uri"
jwt_secret_key = "your-jwt-secret"
ipinfo_token   = "your-ipinfo-token"
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### 3. Deploy Application

Option A: Using the deploy script
```bash
cd infrastructure/scripts
chmod +x deploy.sh
./deploy.sh full
```

Option B: Using GitHub Actions (automated on push to main)
- Set up GitHub secrets (see below)
- Push to main branch

## GitHub Actions Secrets

Set these secrets in your GitHub repository:

| Secret Name | Description |
|-------------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | From Terraform output: `frontend_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From Terraform output: `cloudfront_distribution_id` |
| `LAMBDA_FUNCTION_NAME` | From Terraform output: `lambda_function_name` |
| `DOMAIN_NAME` | `manneharshithsiddardha.com` |

## File Structure

```
infrastructure/
├── terraform/
│   ├── main.tf              # Provider and backend config
│   ├── variables.tf         # Input variables
│   ├── outputs.tf           # Output values
│   ├── s3.tf                # S3 bucket for frontend
│   ├── cloudfront.tf        # CloudFront distribution + DNS
│   ├── lambda.tf            # Lambda function + API Gateway
│   ├── acm.tf               # SSL certificate
│   └── terraform.tfvars.example  # Example variables
└── scripts/
    └── deploy.sh            # Deployment automation script
```

## Terraform Commands

```bash
# Initialize
terraform init

# Format code
terraform fmt

# Validate configuration
terraform validate

# Preview changes
terraform plan

# Apply changes
terraform apply

# Show outputs
terraform output

# Destroy everything
terraform destroy
```

## Updating the Application

### Frontend Only
```bash
./infrastructure/scripts/deploy.sh frontend
```

### Backend Only
```bash
./infrastructure/scripts/deploy.sh backend
```

### Full Deployment
```bash
./infrastructure/scripts/deploy.sh full
```

## Security Features

- ✅ **HTTPS Only** - All traffic encrypted via CloudFront
- ✅ **S3 Private** - No public access, CloudFront OAC only
- ✅ **IAM Least Privilege** - Lambda has minimal permissions
- ✅ **Rate Limiting** - API Gateway throttling configured
- ✅ **CORS Restricted** - Only allow requests from your domain
- ✅ **Secrets in Environment** - No hardcoded credentials

## Monitoring

### CloudWatch Logs
- Lambda logs: `/aws/lambda/portfolio-backend`
- API Gateway logs: `/aws/apigateway/portfolio-api`

### Useful Commands
```bash
# View Lambda logs
aws logs tail /aws/lambda/portfolio-backend --follow

# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/portfolio-backend \
  --filter-pattern "ERROR"
```

## Troubleshooting

### Certificate Validation Pending
Wait 5-10 minutes for DNS propagation. Check status:
```bash
aws acm describe-certificate --certificate-arn <ARN> --query 'Certificate.Status'
```

### CloudFront 403 Error
Check S3 bucket policy and OAC configuration.

### Lambda Timeout
Increase `lambda_timeout` in `terraform.tfvars`.

### Cold Start Issues
Consider increasing `lambda_memory_size` (more memory = faster CPU).
