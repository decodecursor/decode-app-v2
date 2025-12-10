#!/bin/bash

# AWS Lambda Deployment Script for Auction Closer Function
# Deploys the EventBridge → Lambda → Vercel API proxy

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="auction-closer"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
LAMBDA_DIR="aws-lambda/auction-closer"
ZIP_FILE="function.zip"
ROLE_NAME="auction-closer-lambda-role"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AWS Lambda Deployment Script${NC}"
echo -e "${GREEN}Function: ${FUNCTION_NAME}${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v zip &> /dev/null; then
    echo -e "${RED}ERROR: zip command is not installed${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}ERROR: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}✓ AWS CLI installed${NC}"
echo -e "${GREEN}✓ AWS credentials configured${NC}"
echo -e "Account ID: ${AWS_ACCOUNT_ID}"
echo -e "Region: ${AWS_REGION}"

# Get API endpoint from user
echo -e "\n${YELLOW}Enter your Vercel API endpoint:${NC}"
read -p "API_ENDPOINT (e.g., https://app.welovedecode.com/api/auctions/eventbridge/close): " API_ENDPOINT

if [ -z "$API_ENDPOINT" ]; then
    echo -e "${RED}ERROR: API_ENDPOINT is required${NC}"
    exit 1
fi

# Create or update IAM role
echo -e "\n${YELLOW}Creating/updating IAM role...${NC}"

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

# Check if role exists
if aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo -e "${GREEN}✓ IAM role already exists${NC}"
else
    echo "Creating IAM role..."
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document "$TRUST_POLICY" \
        --description "Execution role for auction-closer Lambda function"

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    echo -e "${GREEN}✓ IAM role created${NC}"
    echo "Waiting 10 seconds for role to propagate..."
    sleep 10
fi

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

# Package Lambda function
echo -e "\n${YELLOW}Packaging Lambda function...${NC}"

cd $LAMBDA_DIR
rm -f $ZIP_FILE
zip $ZIP_FILE index.mjs

if [ ! -f $ZIP_FILE ]; then
    echo -e "${RED}ERROR: Failed to create zip file${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Function packaged${NC}"

# Deploy Lambda function
echo -e "\n${YELLOW}Deploying Lambda function...${NC}"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $AWS_REGION &> /dev/null; then
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$ZIP_FILE \
        --region $AWS_REGION

    # Update configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --environment "Variables={API_ENDPOINT=$API_ENDPOINT}" \
        --region $AWS_REGION

    echo -e "${GREEN}✓ Function updated${NC}"
else
    echo "Creating new function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://$ZIP_FILE \
        --environment "Variables={API_ENDPOINT=$API_ENDPOINT}" \
        --timeout 10 \
        --memory-size 128 \
        --region $AWS_REGION

    echo -e "${GREEN}✓ Function created${NC}"
fi

# Add EventBridge Scheduler permission
echo -e "\n${YELLOW}Adding EventBridge Scheduler permission...${NC}"

aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id AllowEventBridgeSchedulerInvoke \
    --action lambda:InvokeFunction \
    --principal scheduler.amazonaws.com \
    --region $AWS_REGION \
    2>/dev/null || echo "Permission already exists"

echo -e "${GREEN}✓ Permission configured${NC}"

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function \
    --function-name $FUNCTION_NAME \
    --region $AWS_REGION \
    --query 'Configuration.FunctionArn' \
    --output text)

# Clean up
cd ../..
rm -f $LAMBDA_DIR/$ZIP_FILE

# Output summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nFunction ARN:"
echo -e "${YELLOW}${FUNCTION_ARN}${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Copy the Function ARN above"
echo "2. Add it to Vercel environment variables:"
echo "   Variable name: LAMBDA_AUCTION_CLOSER_ARN"
echo "   Value: ${FUNCTION_ARN}"
echo ""
echo "3. Update your EventBridge IAM role (EVENTBRIDGE_ROLE_ARN) to allow invoking this Lambda:"
echo "   Add this to the role's policy:"
echo "   {"
echo "     \"Effect\": \"Allow\","
echo "     \"Action\": \"lambda:InvokeFunction\","
echo "     \"Resource\": \"${FUNCTION_ARN}\""
echo "   }"
echo ""
echo -e "${GREEN}Test the function with:${NC}"
echo "aws lambda invoke --function-name $FUNCTION_NAME --region $AWS_REGION --payload '{\"auctionId\":\"test-123\",\"source\":\"manual-test\"}' response.json"
