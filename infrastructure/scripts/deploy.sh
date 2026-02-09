#!/bin/bash

# =============================================================================
# Portfolio AWS Deployment Script
# =============================================================================
# This script handles the complete deployment of the portfolio infrastructure
# and application to AWS using Terraform and AWS CLI.
#
# Usage:
#   ./deploy.sh [plan|apply|destroy]
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Terraform installed (>= 1.0)
#   - Node.js and npm installed (for frontend build)
#   - Python 3.11 installed (for backend packaging)
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
FRONTEND_DIR="$ROOT_DIR/portfolio-frontend"
BACKEND_DIR="$ROOT_DIR/portfolio-backend"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

# =============================================================================
# Terraform Operations
# =============================================================================

terraform_init() {
    log_info "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    terraform init -upgrade
    log_success "Terraform initialized!"
}

terraform_plan() {
    log_info "Creating Terraform plan..."
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvars not found. Please copy terraform.tfvars.example and fill in your values."
        exit 1
    fi
    
    terraform plan -out=tfplan
    log_success "Terraform plan created!"
}

terraform_apply() {
    log_info "Applying Terraform configuration..."
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "tfplan" ]; then
        terraform_plan
    fi
    
    terraform apply tfplan
    rm -f tfplan
    log_success "Infrastructure deployed!"
    
    # Get outputs
    echo ""
    terraform output deployment_summary
}

terraform_destroy() {
    log_warning "This will destroy all AWS resources!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        cd "$TERRAFORM_DIR"
        terraform destroy -auto-approve
        log_success "Infrastructure destroyed!"
    else
        log_info "Destroy cancelled."
    fi
}

# =============================================================================
# Frontend Build & Deploy
# =============================================================================

build_frontend() {
    log_info "Building frontend..."
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    npm ci
    
    # Build
    npm run build
    
    log_success "Frontend built!"
}

deploy_frontend() {
    log_info "Deploying frontend to S3..."
    cd "$TERRAFORM_DIR"
    
    # Get S3 bucket name from Terraform output
    S3_BUCKET=$(terraform output -raw frontend_bucket_name)
    CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
    
    # Sync to S3
    aws s3 sync "$FRONTEND_DIR/dist" "s3://$S3_BUCKET/" \
        --delete \
        --cache-control "public, max-age=31536000" \
        --exclude "index.html" \
        --exclude "*.json"
    
    # Upload index.html with no-cache
    aws s3 cp "$FRONTEND_DIR/dist/index.html" "s3://$S3_BUCKET/index.html" \
        --cache-control "no-cache, no-store, must-revalidate"
    
    # Invalidate CloudFront
    log_info "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/*"
    
    log_success "Frontend deployed!"
}

# =============================================================================
# Backend Build & Deploy
# =============================================================================

build_backend() {
    log_info "Building backend Lambda package..."
    cd "$BACKEND_DIR"
    
    # Create package directory
    rm -rf package lambda-deployment.zip
    mkdir -p package
    
    # Install dependencies
    pip install -r requirements.txt -t package/ --upgrade
    
    # Copy application code
    cp -r *.py package/ 2>/dev/null || true
    cp -r blueprints models services utils package/
    
    # Create zip
    cd package
    zip -r9 ../lambda-deployment.zip .
    cd ..
    
    log_success "Backend package created!"
}

deploy_backend() {
    log_info "Deploying backend to Lambda..."
    cd "$TERRAFORM_DIR"
    
    # Get Lambda function name
    LAMBDA_NAME=$(terraform output -raw lambda_function_name)
    
    # Deploy
    aws lambda update-function-code \
        --function-name "$LAMBDA_NAME" \
        --zip-file "fileb://$BACKEND_DIR/lambda-deployment.zip" \
        --publish
    
    # Wait for update
    aws lambda wait function-updated --function-name "$LAMBDA_NAME"
    
    log_success "Backend deployed!"
}

# =============================================================================
# Full Deployment
# =============================================================================

full_deploy() {
    log_info "Starting full deployment..."
    
    check_prerequisites
    terraform_init
    terraform_apply
    
    build_frontend
    deploy_frontend
    
    build_backend
    deploy_backend
    
    log_success "Full deployment complete!"
    
    cd "$TERRAFORM_DIR"
    echo ""
    echo "=========================================="
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "=========================================="
    terraform output deployment_summary
}

# =============================================================================
# Main
# =============================================================================

case "${1:-full}" in
    "init")
        terraform_init
        ;;
    "plan")
        terraform_init
        terraform_plan
        ;;
    "apply")
        terraform_init
        terraform_apply
        ;;
    "destroy")
        terraform_destroy
        ;;
    "frontend")
        build_frontend
        deploy_frontend
        ;;
    "backend")
        build_backend
        deploy_backend
        ;;
    "full"|"")
        full_deploy
        ;;
    *)
        echo "Usage: $0 [init|plan|apply|destroy|frontend|backend|full]"
        echo ""
        echo "Commands:"
        echo "  init      - Initialize Terraform"
        echo "  plan      - Create Terraform plan"
        echo "  apply     - Apply Terraform configuration"
        echo "  destroy   - Destroy all resources"
        echo "  frontend  - Build and deploy frontend only"
        echo "  backend   - Build and deploy backend only"
        echo "  full      - Complete deployment (default)"
        exit 1
        ;;
esac
