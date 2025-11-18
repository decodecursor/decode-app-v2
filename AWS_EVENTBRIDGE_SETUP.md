# AWS EventBridge Scheduler Setup Guide

This document explains how to set up AWS EventBridge Scheduler for precise auction closing.

## Overview

The application uses AWS EventBridge Scheduler to trigger auction closures at the exact `end_time` instead of relying on periodic cron jobs. This ensures:
- **Immediate payment capture** when auction ends (0 second delay)
- **Instant winner notification** with video recording token
- **Precise timing** - no 0-5 minute delay
- **Scalability** - handles any number of auctions

---

## Prerequisites

1. AWS Account
2. AWS CLI installed and configured
3. Permissions to create IAM roles and EventBridge resources

---

## Step 1: Create IAM Role for EventBridge Scheduler

### 1.1 Create Trust Policy

Create a file `eventbridge-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "scheduler.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 1.2 Create IAM Role

```bash
aws iam create-role \
  --role-name EventBridgeSchedulerRole \
  --assume-role-policy-document file://eventbridge-trust-policy.json
```

### 1.3 Create Permission Policy

Create a file `eventbridge-permissions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "scheduler:ListSchedules"
      ],
      "Resource": "*"
    },
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

### 1.4 Attach Policy to Role

```bash
aws iam put-role-policy \
  --role-name EventBridgeSchedulerRole \
  --policy-name EventBridgeSchedulerPolicy \
  --policy-document file://eventbridge-permissions-policy.json
```

### 1.5 Get Role ARN

```bash
aws iam get-role --role-name EventBridgeSchedulerRole --query 'Role.Arn' --output text
```

Copy this ARN - you'll need it for environment variables.

---

## Step 2: Create EventBridge Schedule Group

```bash
aws scheduler create-schedule-group \
  --name decode-auctions \
  --region us-east-1
```

---

## Step 3: Deploy Lambda Function

EventBridge Scheduler cannot invoke HTTP endpoints directly. We use a Lambda function as a proxy.

### 3.1 Create Lambda Function (AWS Console - Easiest)

1. Go to **AWS Lambda Console** → **Create function**
2. Choose **"Author from scratch"**
3. Settings:
   - **Function name:** `auction-closer`
   - **Runtime:** Node.js 20.x
   - **Architecture:** x86_64
4. Click **"Create function"**

### 3.2 Deploy Function Code

1. In the Lambda function page, go to **Code** tab
2. Copy the contents of `aws-lambda/auction-closer/index.mjs` from your repo
3. Paste into the code editor (replace the default code)
4. Click **"Deploy"**

### 3.3 Set Environment Variables

1. Go to **Configuration** → **Environment variables**
2. Click **"Edit"** → **"Add environment variable"**
3. Add:
   - **Key:** `API_ENDPOINT`
   - **Value:** `https://your-app.vercel.app/api/auctions/eventbridge/close`
4. Click **"Save"**

### 3.4 Add EventBridge Permission

Allow EventBridge Scheduler to invoke this Lambda:

```bash
aws lambda add-permission \
  --function-name auction-closer \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal scheduler.amazonaws.com
```

Or via Console:
1. Lambda → auction-closer → **Configuration** → **Permissions**
2. **Resource-based policy statements** → **Add permissions**
3. **Service:** EventBridge Scheduler
4. **Action:** lambda:InvokeFunction
5. **Principal:** scheduler.amazonaws.com

### 3.5 Get Lambda ARN

Copy the **Function ARN** (top right of the Lambda page):
```
arn:aws:lambda:us-east-1:123456789012:function:auction-closer
```

**Save this ARN** - you'll need it for Vercel environment variables.

---

## Step 4: Create IAM User for Programmatic Access

### 4.1 Create IAM User

```bash
aws iam create-user --user-name eventbridge-scheduler-user
```

### 4.2 Create Access Policy

Create a file `user-access-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "scheduler:UpdateSchedule"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/EventBridgeSchedulerRole"
    }
  ]
}
```

**Replace `YOUR_ACCOUNT_ID` with your AWS account ID.**

### 4.3 Attach Policy

```bash
aws iam put-user-policy \
  --user-name eventbridge-scheduler-user \
  --policy-name EventBridgeSchedulerAccess \
  --policy-document file://user-access-policy.json
```

### 4.4 Create Access Keys

```bash
aws iam create-access-key --user-name eventbridge-scheduler-user
```

Save the `AccessKeyId` and `SecretAccessKey` - you'll need these for environment variables.

---

## Step 5: Add Environment Variables

### 5.1 Locally (.env.local)

Add these to your `.env.local` file:

```bash
# AWS EventBridge Scheduler
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your-access-key
AWS_SECRET_ACCESS_KEY=...your-secret-key
EVENTBRIDGE_SCHEDULE_GROUP=decode-auctions
EVENTBRIDGE_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/EventBridgeSchedulerRole
LAMBDA_AUCTION_CLOSER_ARN=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:auction-closer

# Already exists - make sure it's set
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 5.2 On Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `AWS_REGION` | `us-east-1` | Production, Preview, Development |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Production, Preview, Development |
| `AWS_SECRET_ACCESS_KEY` | `...` | Production, Preview, Development |
| `EVENTBRIDGE_SCHEDULE_GROUP` | `decode-auctions` | Production, Preview, Development |
| `EVENTBRIDGE_ROLE_ARN` | `arn:aws:iam::...` | Production, Preview, Development |
| `LAMBDA_AUCTION_CLOSER_ARN` | `arn:aws:lambda:...` | Production, Preview, Development |

---

## Step 6: Run Database Migration

Run the migration to add the `scheduler_event_id` column:

```bash
# Using Supabase CLI
supabase db push

# Or manually execute the migration file
psql $DATABASE_URL -f migrations/20250118_add_scheduler_event_id.sql
```

---

## Step 7: Deploy to Vercel

```bash
npm install
git add .
git commit -m "Add EventBridge scheduler for precise auction closing"
git push
```

Vercel will automatically deploy. The 5-minute cron error should now be gone.

---

## Step 8: Test the Integration

### 8.1 Create a Test Auction (Development Only)

```bash
curl -X POST https://your-app.vercel.app/api/auctions/test/create-short \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

This creates a 5-minute test auction.

### 8.2 Verify EventBridge Schedule Created

```bash
aws scheduler list-schedules \
  --group-name decode-auctions \
  --region us-east-1
```

You should see a schedule named `auction-close-<auction-id>`.

### 8.3 Wait for Auction to End

After 5 minutes, check:
1. **EventBridge Logs** - Verify the schedule fired
2. **Your app logs** - Check `/api/auctions/eventbridge/close` was called
3. **Database** - Auction status should be `completed`
4. **Email** - Winner should receive notification

---

## Monitoring & Debugging

### View EventBridge Schedules

```bash
aws scheduler list-schedules --group-name decode-auctions --region us-east-1
```

### View Schedule Details

```bash
aws scheduler get-schedule \
  --group-name decode-auctions \
  --name auction-close-<auction-id> \
  --region us-east-1
```

### Delete a Stuck Schedule

```bash
aws scheduler delete-schedule \
  --group-name decode-auctions \
  --name auction-close-<auction-id> \
  --region us-east-1
```

### Check CloudWatch Logs

EventBridge Scheduler logs appear in CloudWatch under:
- Log group: `/aws/events/scheduler/decode-auctions`

---

## Cost Estimation

**EventBridge Scheduler Pricing (us-east-1):**
- First 14 million invocations/month: **FREE**
- Beyond 14M: $1.00 per million invocations

**Expected Cost:**
- 1,000 auctions/day = 30,000/month = **$0 (free tier)**
- 10,000 auctions/day = 300,000/month = **$0 (free tier)**
- 1 million auctions/month = **$0 (free tier)**

You won't pay anything unless you exceed 14 million auctions/month.

---

## Troubleshooting

### Error: "Missing required environment variables"

**Solution:** Ensure all 5 environment variables are set in Vercel:
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
EVENTBRIDGE_SCHEDULE_GROUP
EVENTBRIDGE_ROLE_ARN
```

### Error: "Access Denied" when creating schedule

**Solution:** Verify IAM user has `iam:PassRole` permission for the EventBridge role.

### Schedule created but endpoint not called

**Solution:**
1. Check the target URL in EventBridge schedule
2. Verify `NEXT_PUBLIC_APP_URL` is set correctly
3. Check CloudWatch Logs for errors

### Auction doesn't close at exact time

**Solution:**
1. Verify schedule was created (check `scheduler_event_id` in database)
2. Check EventBridge schedule exists in AWS console
3. Review CloudWatch Logs for invocation errors

---

## Rollback Plan

If EventBridge fails, the system includes automatic fallbacks:

1. **EventBridge fails during auction creation** → Auction still created, cron fallback handles it
2. **EventBridge endpoint fails** → Built-in retry (up to 185 days)
3. **Complete EventBridge failure** → Can re-enable hourly cron as safety net

To re-enable cron fallback, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/auctions/cron/close-auctions",
      "schedule": "0 */1 * * *"
    }
  ]
}
```

---

## Support

For AWS EventBridge Scheduler documentation:
https://docs.aws.amazon.com/scheduler/latest/UserGuide/

For issues with this implementation:
- Check application logs
- Review CloudWatch Logs
- Verify environment variables
- Test with 5-minute auction
