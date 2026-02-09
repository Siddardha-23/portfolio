# Deploy backend to AWS Lambda
Write-Host "Starting deployment..."
if (!(Test-Path "package")) { New-Item -ItemType Directory -Force -Path "package" }
pip install -r requirements.txt -t package/ --upgrade --quiet
Copy-Item -Path "*.py" -Destination "package/" -Force
Copy-Item -Path "blueprints", "models", "services", "utils" -Destination "package/" -Recurse -Force
Set-Location package
Write-Host "Zipping package..."
Compress-Archive -Path * -DestinationPath ..\lambda.zip -Force
Set-Location ..
Write-Host "Updating Lambda function..."
aws lambda update-function-code --function-name portfolio-backend --zip-file fileb://lambda.zip --profile portfolio
Write-Host "Deployment complete!"
