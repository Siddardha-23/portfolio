# 🚀 Complete AWS Deployment Guide

This guide walks you through **every step** to deploy your portfolio to AWS using S3 + CloudFront + Lambda with secrets stored in SSM Parameter Store.

---

## 📋 Table of Contents

1. [Prerequisites](#-step-1-prerequisites)
2. [Create IAM User for Deployment](#-step-2-create-iam-user-for-deployment)
3. [Configure AWS CLI](#-step-3-configure-aws-cli)
4. [Set Up Terraform Variables](#-step-4-set-up-terraform-variables)
5. [Deploy Infrastructure with Terraform](#-step-5-deploy-infrastructure-with-terraform)
6. [Configure Bitbucket Pipeline](#-step-6-configure-bitbucket-pipeline)
7. [First Deployment](#-step-7-first-deployment)
8. [Verify Everything Works](#-step-8-verify-everything-works)

---

## 🔧 Step 1: Prerequisites

### 1.1 Install AWS CLI

**Windows (PowerShell as Administrator):**
```powershell
# Download and run the installer
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify installation (open new terminal)
aws --version
```

Or download from: https://aws.amazon.com/cli/

### 1.2 Install Terraform

**Windows (PowerShell as Administrator):**
```powershell
# Option 1: Using Chocolatey
choco install terraform

# Option 2: Using winget
winget install Hashicorp.Terraform

# Verify installation
terraform --version
```

Or download from: https://developer.hashicorp.com/terraform/downloads

### 1.3 Verify Your Domain in Route 53

Make sure your domain `manneharshithsiddardha.com` has:
- ✅ A Hosted Zone in Route 53
- ✅ NS records pointing to AWS nameservers at your domain registrar

---

## 👤 Step 2: Create IAM User for Deployment

### 2.1 Create the IAM Policy

1. Go to **AWS Console** → **IAM** → **Policies** → **Create Policy**
2. Click **JSON** tab
3. Paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3FullAccess",
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": [
                "arn:aws:s3:::portfolio-*",
                "arn:aws:s3:::portfolio-*/*"
            ]
        },
        {
            "Sid": "CloudFrontAccess",
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetDistribution",
                "cloudfront:GetDistributionConfig",
                "cloudfront:ListDistributions",
                "cloudfront:UpdateDistribution",
                "cloudfront:CreateDistribution",
                "cloudfront:DeleteDistribution",
                "cloudfront:TagResource",
                "cloudfront:CreateOriginAccessControl",
                "cloudfront:DeleteOriginAccessControl",
                "cloudfront:GetOriginAccessControl",
                "cloudfront:ListOriginAccessControls"
            ],
            "Resource": "*"
        },
        {
            "Sid": "LambdaAccess",
            "Effect": "Allow",
            "Action": [
                "lambda:*"
            ],
            "Resource": [
                "arn:aws:lambda:*:*:function:portfolio-*"
            ]
        },
        {
            "Sid": "APIGatewayAccess",
            "Effect": "Allow",
            "Action": [
                "apigateway:*"
            ],
            "Resource": [
                "arn:aws:apigateway:*::/*"
            ]
        },
        {
            "Sid": "IAMRoleAccess",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
                "iam:PassRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:GetRolePolicy",
                "iam:TagRole",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies"
            ],
            "Resource": [
                "arn:aws:iam::*:role/portfolio-*"
            ]
        },
        {
            "Sid": "ACMAccess",
            "Effect": "Allow",
            "Action": [
                "acm:RequestCertificate",
                "acm:DescribeCertificate",
                "acm:DeleteCertificate",
                "acm:ListCertificates",
                "acm:AddTagsToCertificate",
                "acm:ListTagsForCertificate"
            ],
            "Resource": "*"
        },
        {
            "Sid": "Route53Access",
            "Effect": "Allow",
            "Action": [
                "route53:GetHostedZone",
                "route53:ListHostedZones",
                "route53:ChangeResourceRecordSets",
                "route53:GetChange",
                "route53:ListResourceRecordSets"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SSMAccess",
            "Effect": "Allow",
            "Action": [
                "ssm:PutParameter",
                "ssm:GetParameter",
                "ssm:GetParameters",
                "ssm:DeleteParameter",
                "ssm:DescribeParameters",
                "ssm:ListTagsForResource",
                "ssm:AddTagsToResource"
            ],
            "Resource": [
                "arn:aws:ssm:*:*:parameter/portfolio/*"
            ]
        },
        {
            "Sid": "CloudWatchLogsAccess",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:DeleteLogGroup",
                "logs:DescribeLogGroups",
                "logs:PutRetentionPolicy",
                "logs:TagResource",
                "logs:ListTagsForResource"
            ],
            "Resource": [
                "arn:aws:logs:*:*:log-group:/aws/lambda/portfolio-*",
                "arn:aws:logs:*:*:log-group:/aws/apigateway/portfolio-*"
            ]
        },
        {
            "Sid": "KMSAccess",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "ssm.us-east-1.amazonaws.com"
                }
            }
        },
        {
            "Sid": "STSGetCallerIdentity",
            "Effect": "Allow",
            "Action": "sts:GetCallerIdentity",
            "Resource": "*"
        }
    ]
}
```

4. Click **Next**
5. **Policy name**: `PortfolioDeploymentPolicy`
6. Click **Create policy**

### 2.2 Create the IAM User

1. Go to **IAM** → **Users** → **Create user**
2. **User name**: `portfolio-deployer`
3. Click **Next**
4. Select **Attach policies directly**
5. Search for `PortfolioDeploymentPolicy` and check it
6. Click **Next** → **Create user**

### 2.3 Create Access Keys

1. Click on the user `portfolio-deployer`
2. Go to **Security credentials** tab
3. Scroll to **Access keys** → **Create access key**
4. Select **Command Line Interface (CLI)**
5. Check "I understand..." checkbox
6. Click **Next** → **Create access key**
7. **⚠️ IMPORTANT**: Copy and save both:
   - **Access key ID**: `AKIA...`
   - **Secret access key**: `wJalr...`
   
   You won't be able to see the secret again!

---

## 💻 Step 3: Configure AWS CLI

Open a terminal and run:

```bash
aws configure
```

Enter the following when prompted:
```
AWS Access Key ID [None]: AKIA... (your access key)
AWS Secret Access Key [None]: wJalr... (your secret key)
Default region name [None]: us-east-1
Default output format [None]: json
```

**Verify it works:**
```bash
aws sts get-caller-identity
```

You should see your account ID and user ARN.

---

## 📝 Step 4: Set Up Terraform Variables

### 4.1 Get Your Current Secrets

Look at your current `.env` file in `portfolio-backend`:

```bash
# View your current secrets (Windows)
type portfolio-backend\.env
```

You'll need:
- `MONGODB_URI` or `MONGO_URI`
- `JWT_SECRET_KEY`
- `IPINFO_TOKEN` (if you have one)

### 4.2 Create terraform.tfvars

```bash
cd infrastructure/terraform
copy terraform.tfvars.example terraform.tfvars
```

### 4.3 Edit terraform.tfvars

Open `infrastructure/terraform/terraform.tfvars` in your editor and fill in:

```hcl
# AWS Configuration
aws_region   = "us-east-1"
project_name = "portfolio"
environment  = "prod"

# Your domain
domain_name = "manneharshithsiddardha.com"

# COPY THESE FROM YOUR .env FILE:
mongodb_uri    = "REPLACE_WITH_YOUR_MONGODB_URI"
jwt_secret_key = "REPLACE_WITH_YOUR_JWT_SECRET"
ipinfo_token   = ""  # Leave empty if you don't have one

# Lambda settings (keep defaults)
lambda_memory_size = 512
lambda_timeout     = 30

# Feature flags
enable_waf     = false
enable_logging = true
```

**⚠️ IMPORTANT**: Never commit `terraform.tfvars` to Git! It's already in `.gitignore`.

---

## 🏗️ Step 5: Deploy Infrastructure with Terraform

### 5.1 Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

You should see: `Terraform has been successfully initialized!`

### 5.2 Preview the Changes

```bash
terraform plan
```

This shows what will be created. You should see ~20-25 resources.

### 5.3 Deploy!

```bash
terraform apply
```

When prompted, type `yes` and press Enter.

**⏳ This takes 10-15 minutes** because:
- ACM certificate needs DNS validation (~5-10 min)
- CloudFront distribution creation (~5 min)

### 5.4 Save the Outputs

When complete, you'll see a summary. **Copy these values** - you'll need them for Bitbucket:

```
Outputs:

frontend_bucket_name = "portfolio-frontend-123456789012"
cloudfront_distribution_id = "E1234567890ABC"
lambda_function_name = "portfolio-backend"
...
```

Or run:
```bash
terraform output
```

---

## 🔧 Step 6: Configure Bitbucket Pipeline

### 6.1 Enable Pipelines

1. Go to your Bitbucket repository
2. Click **Repository settings** (gear icon)
3. Click **Pipelines** → **Settings**
4. Toggle **Enable Pipelines** to ON

### 6.2 Add Repository Variables

1. Go to **Repository settings** → **Pipelines** → **Repository variables**
2. Add these variables:

| Name | Value | Secured? |
|------|-------|----------|
| `AWS_ACCESS_KEY_ID` | Your access key from Step 2.3 | ✅ Yes |
| `AWS_SECRET_ACCESS_KEY` | Your secret key from Step 2.3 | ✅ Yes |
| `S3_BUCKET_NAME` | From terraform output (e.g., `portfolio-frontend-123456789012`) | No |
| `CLOUDFRONT_DISTRIBUTION_ID` | From terraform output (e.g., `E1234567890ABC`) | No |
| `LAMBDA_FUNCTION_NAME` | From terraform output (e.g., `portfolio-backend`) | No |
| `DOMAIN_NAME` | `manneharshithsiddardha.com` | No |

**Screenshot locations:**
- Repository variables: Repository → Settings → Pipelines → Repository variables

---

## 🚀 Step 7: First Deployment

### Option A: Push to Trigger Pipeline

```bash
# From your Portfolio root directory
git add .
git commit -m "Add AWS infrastructure and CI/CD pipeline"
git push origin main
```

The pipeline will automatically run and deploy both frontend and backend.

### Option B: Manual Deployment (if pipeline isn't ready)

```bash
# Deploy frontend
cd portfolio-frontend
npm install
npm run build

# Upload to S3 (replace with your bucket name)
aws s3 sync dist/ s3://YOUR-BUCKET-NAME/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR-DISTRIBUTION-ID --paths "/*"
```

```bash
# Deploy backend
cd portfolio-backend
pip install -r requirements.txt -t package/
cp -r *.py blueprints models services utils package/
cd package && zip -r ../lambda.zip . && cd ..

# Upload to Lambda
aws lambda update-function-code --function-name portfolio-backend --zip-file fileb://lambda.zip
```

---

## ✅ Step 8: Verify Everything Works

### 8.1 Check Your Website

Open in browser:
- **Main site**: https://manneharshithsiddardha.com
- **WWW**: https://www.manneharshithsiddardha.com
- **API Health**: https://manneharshithsiddardha.com/api/health

### 8.2 Check CloudWatch Logs (if issues)

1. Go to **AWS Console** → **CloudWatch** → **Log groups**
2. Look at `/aws/lambda/portfolio-backend`
3. Check for errors

### 8.3 Verify SSM Secrets (Optional)

```bash
aws ssm get-parameters-by-path \
  --path "/portfolio/prod" \
  --recursive \
  --query "Parameters[*].Name"
```

---

## 🔧 Troubleshooting

### Certificate Stuck in "Pending validation"

Wait 5-10 minutes. If still pending:
```bash
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw certificate_arn) \
  --query 'Certificate.DomainValidationOptions'
```

### CloudFront Returns 403

Check S3 bucket policy:
```bash
aws s3api get-bucket-policy --bucket $(terraform output -raw frontend_bucket_name)
```

### Lambda Returns 500

Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/portfolio-backend --follow
```

### API Gateway Returns 403/CORS Error

Verify CORS in API Gateway:
```bash
aws apigatewayv2 get-api --api-id $(terraform output -raw api_gateway_id)
```

---

## 📊 Final Checklist

Before pushing to production, verify:

- [ ] `terraform apply` completed successfully
- [ ] All 6 Bitbucket variables are set
- [ ] Bitbucket Pipelines is enabled
- [ ] Domain DNS is pointing to CloudFront
- [ ] HTTPS certificate is issued (not pending)
- [ ] `/api/health` returns `{"status": "healthy"}`
- [ ] Frontend loads correctly
- [ ] Contact form works
- [ ] Visitor tracking works

---

## 🎉 Done!

Your portfolio is now deployed with:
- ✅ **Frontend** on S3 + CloudFront (global CDN)
- ✅ **Backend** on Lambda (serverless)
- ✅ **Secrets** in SSM Parameter Store (encrypted)
- ✅ **CI/CD** via Bitbucket Pipelines
- ✅ **HTTPS** via ACM certificate
- ✅ **Custom domain** via Route 53

**Estimated monthly cost: $2-5**

---

## 📚 Quick Reference

### Useful Commands

```bash
# View Terraform outputs
cd infrastructure/terraform && terraform output

# Update Lambda code manually
aws lambda update-function-code --function-name portfolio-backend --zip-file fileb://lambda.zip

# Clear CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"

# View Lambda logs
aws logs tail /aws/lambda/portfolio-backend --follow

# Update SSM secret
aws ssm put-parameter \
  --name "/portfolio/prod/mongodb-uri" \
  --value "new-value" \
  --type SecureString \
  --overwrite
```

### Important Paths

| Resource | AWS Console Path |
|----------|-----------------|
| S3 Bucket | S3 → Buckets → portfolio-frontend-* |
| CloudFront | CloudFront → Distributions |
| Lambda | Lambda → Functions → portfolio-backend |
| API Gateway | API Gateway → APIs → portfolio-api |
| SSM Secrets | Systems Manager → Parameter Store |
| Logs | CloudWatch → Log groups |
| Certificate | Certificate Manager |
