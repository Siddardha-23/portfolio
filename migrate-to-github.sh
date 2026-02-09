#!/bin/bash
# =============================================================================
# GitHub Monorepo Migration Script
# =============================================================================
# This script migrates from separate repos to a single GitHub monorepo
#
# Run this from the Portfolio directory:
#   bash migrate-to-github.sh
# =============================================================================

set -e

echo "🚀 Starting GitHub Monorepo Migration"
echo "======================================"
echo ""

# Check we're in the right directory
if [ ! -d "portfolio-frontend" ] || [ ! -d "portfolio-backend" ]; then
    echo "❌ Error: Run this script from the Portfolio root directory"
    exit 1
fi

# Step 1: Remove old git repositories
echo "📁 Step 1: Removing old .git folders from subdirectories..."
if [ -d "portfolio-frontend/.git" ]; then
    rm -rf portfolio-frontend/.git
    echo "   ✅ Removed portfolio-frontend/.git"
fi

if [ -d "portfolio-backend/.git" ]; then
    rm -rf portfolio-backend/.git
    echo "   ✅ Removed portfolio-backend/.git"
fi

# Step 2: Initialize new git repo at root
echo ""
echo "📁 Step 2: Initializing new git repository at root..."
if [ -d ".git" ]; then
    echo "   ⚠️  .git already exists at root, skipping init"
else
    git init
    echo "   ✅ Initialized new git repository"
fi

# Step 3: Create comprehensive .gitignore
echo ""
echo "📁 Step 3: Creating root .gitignore..."
cat > .gitignore << 'EOF'
# =============================================================================
# Root .gitignore for Portfolio Monorepo
# =============================================================================

# Dependencies
node_modules/
env/
venv/
__pycache__/
*.py[cod]
*$py.class

# Build outputs
dist/
build/
*.egg-info/

# Environment files (SECRETS!)
.env
.env.local
.env.*.local
portfolio-backend/.env

# IDE
.vscode/
.idea/
*.swp
*.swo
.mgx/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Terraform
infrastructure/terraform/.terraform/
infrastructure/terraform/*.tfstate
infrastructure/terraform/*.tfstate.*
infrastructure/terraform/terraform.tfvars
infrastructure/terraform/*.tfplan
infrastructure/terraform/tfplan
infrastructure/terraform/*.zip

# Python
*.pyc
package/
lambda-deployment.zip

# Test
test-env/
coverage/
EOF
echo "   ✅ Created .gitignore"

# Step 4: Stage all files
echo ""
echo "📁 Step 4: Staging files..."
git add .
echo "   ✅ Files staged"

# Step 5: Create initial commit
echo ""
echo "📁 Step 5: Creating initial commit..."
git commit -m "Initial commit: Portfolio monorepo with AWS infrastructure

- Frontend: React/Vite with TypeScript
- Backend: Flask API with JWT authentication
- Infrastructure: Terraform (S3 + CloudFront + Lambda)
- CI/CD: GitHub Actions for automated deployment
- Secrets: AWS SSM Parameter Store"
echo "   ✅ Initial commit created"

echo ""
echo "======================================"
echo "✅ Local migration complete!"
echo ""
echo "Next steps:"
echo "1. Create a new repo on GitHub: https://github.com/new"
echo "   Name: portfolio (or devops-portfolio)"
echo "   DON'T initialize with README"
echo ""
echo "2. Add the remote and push:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/portfolio.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Add GitHub Secrets (Settings → Secrets → Actions):"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - MONGODB_URI"
echo "   - JWT_SECRET_KEY"
echo ""
EOF
