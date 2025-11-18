# Auction Closer Lambda Function

Simple AWS Lambda function that receives EventBridge Scheduler events and forwards them to the Vercel API endpoint.

## Architecture

```
EventBridge Scheduler → Lambda Function → Vercel API (POST /api/auctions/eventbridge/close)
```

## Deployment

### Option 1: AWS Console (Easiest)

1. Go to AWS Lambda Console → Create function
2. Choose "Author from scratch"
3. Settings:
   - Function name: `auction-closer`
   - Runtime: **Node.js 20.x**
   - Architecture: **x86_64**
4. Click "Create function"
5. In the Code tab:
   - Copy contents of `index.mjs`
   - Paste into the code editor
   - Click "Deploy"
6. Configuration → Environment variables:
   - Add `API_ENDPOINT` = `https://your-app.vercel.app/api/auctions/eventbridge/close`
7. Configuration → Permissions:
   - Note the execution role ARN
   - Add policy to allow EventBridge to invoke (see below)
8. Copy the Function ARN (top right) - you'll need this for Vercel env vars

### Option 2: AWS CLI

```bash
# Create function
aws lambda create-function \
  --function-name auction-closer \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip

# Set environment variables
aws lambda update-function-configuration \
  --function-name auction-closer \
  --environment Variables={API_ENDPOINT=https://your-app.vercel.app/api/auctions/eventbridge/close}

# Get function ARN
aws lambda get-function --function-name auction-closer --query 'Configuration.FunctionArn'
```

## IAM Permissions

### Lambda Execution Role

The Lambda function needs basic execution permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### EventBridge Permission to Invoke Lambda

Add this to Lambda's resource-based policy:

```bash
aws lambda add-permission \
  --function-name auction-closer \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal scheduler.amazonaws.com \
  --source-arn "arn:aws:scheduler:us-east-1:YOUR_ACCOUNT_ID:schedule/*"
```

Or via Console:
1. Lambda → auction-closer → Configuration → Permissions
2. Resource-based policy statements → Add permissions
3. Service: EventBridge Scheduler
4. Action: lambda:InvokeFunction
5. Principal: scheduler.amazonaws.com

## Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `API_ENDPOINT` | `https://your-app.vercel.app/api/auctions/eventbridge/close` | Full URL to Vercel API endpoint |

## Testing

### Test Event

Create a test event in Lambda console:

```json
{
  "auctionId": "test-auction-id-123",
  "source": "manual-test",
  "scheduledTime": "2025-01-18T12:00:00.000Z"
}
```

Expected result:
- Lambda returns 200
- API endpoint receives request
- CloudWatch logs show successful invocation

## Monitoring

### CloudWatch Logs

View logs in AWS Console:
- CloudWatch → Log groups → `/aws/lambda/auction-closer`

### Metrics

- Invocations
- Errors
- Duration
- Throttles

## Troubleshooting

### Error: "Missing API_ENDPOINT configuration"

**Solution:** Set the `API_ENDPOINT` environment variable in Lambda configuration.

### Error: API returns 401

**Solution:** Check that the EventBridge header `X-EventBridge-Source` is being sent correctly. The API validates this header.

### Error: API returns 404

**Solution:** Verify the `API_ENDPOINT` URL is correct and the Vercel deployment is live.

### Lambda timeout

**Solution:** Default timeout is 3 seconds. Increase to 10 seconds in Lambda configuration if needed.

## Cost

- **Lambda invocations:** First 1M requests/month are FREE
- **Lambda compute:** First 400,000 GB-seconds/month are FREE
- **Expected cost:** $0 (well within free tier for auction use case)

## Function ARN

After deployment, you'll get a Function ARN like:
```
arn:aws:lambda:us-east-1:123456789012:function:auction-closer
```

**Add this ARN to Vercel environment variables as `LAMBDA_AUCTION_CLOSER_ARN`**
