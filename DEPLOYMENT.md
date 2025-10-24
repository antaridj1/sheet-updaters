# Cloud Run Job Deployment Guide

This guide shows how to deploy the sheet-updaters as a Cloud Run Job that runs daily at 00:00.

## Prerequisites

1. Google Cloud Project with billing enabled
2. `gcloud` CLI installed and authenticated
3. Required APIs enabled:
   - Cloud Run API
   - Cloud Build API
   - Cloud Scheduler API
   - Google Sheets API

## Step 1: Set Environment Variables

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-southeast1"  # or your preferred region
export JOB_NAME="sheet-updater-job"
export SERVICE_ACCOUNT="sheet-updater-sa@${PROJECT_ID}.iam.gserviceaccount.com"
```

## Step 2: Enable Required APIs

```bash
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  sheets.googleapis.com \
  --project=${PROJECT_ID}
```

## Step 3: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create sheet-updater-sa \
  --display-name="Sheet Updater Service Account" \
  --project=${PROJECT_ID}

# Grant Sheets API access
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"
```

## Step 4: Grant Service Account Access to Google Sheets

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Find `sheet-updater-sa@${PROJECT_ID}.iam.gserviceaccount.com`
3. Copy the email address
4. Open your Google Sheet
5. Click "Share" and add the service account email with "Editor" permissions

## Step 5: Build and Deploy Cloud Run Job

```bash
# Build with Cloud Build and deploy as Cloud Run Job
gcloud run jobs deploy ${JOB_NAME} \
  --source . \
  --region=${REGION} \
  --service-account=${SERVICE_ACCOUNT} \
  --set-env-vars="SHEET_ID=YOUR_SHEET_ID,SOURCE_API_URL=YOUR_API_URL,SOURCE_API_KEY=YOUR_API_KEY" \
  --max-retries=2 \
  --task-timeout=10m \
  --project=${PROJECT_ID}
```

**Important:** Replace the environment variables:
- `YOUR_SHEET_ID`: Your Google Sheet ID (from the URL)
- `YOUR_API_URL`: Your source API endpoint
- `YOUR_API_KEY`: Your API key

Optional environment variables (if you need to customize):
```bash
--set-env-vars="SHEET_ID=xxx,SOURCE_API_URL=xxx,SOURCE_API_KEY=xxx,WRITE_RANGE=シート!A2,CLEAR_RANGE=シート!A12:Z2000"
```

## Step 6: Test the Job Manually

```bash
gcloud run jobs execute ${JOB_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

Check the logs:
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=50 \
  --format=json \
  --project=${PROJECT_ID}
```

## Step 7: Create Cloud Scheduler Job (Daily at 00:00)

```bash
# Create scheduler job to run daily at midnight (Asia/Jakarta timezone)
gcloud scheduler jobs create http sheet-updater-daily \
  --location=${REGION} \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Jakarta" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email=${SERVICE_ACCOUNT} \
  --project=${PROJECT_ID}
```

**Note:** Change `--time-zone` to your preferred timezone:
- `Asia/Jakarta` (UTC+7)
- `Asia/Singapore` (UTC+8)
- `Asia/Tokyo` (UTC+9)
- See full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## Step 8: Verify Scheduler

```bash
# List all scheduler jobs
gcloud scheduler jobs list --project=${PROJECT_ID}

# Trigger manually to test
gcloud scheduler jobs run sheet-updater-daily \
  --location=${REGION} \
  --project=${PROJECT_ID}
```

## Update the Job

When you make code changes:

```bash
# Redeploy the job
gcloud run jobs deploy ${JOB_NAME} \
  --source . \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

## Monitoring

View logs in Cloud Console:
```
https://console.cloud.google.com/run/jobs/details/${REGION}/${JOB_NAME}
```

Or via CLI:
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=100 \
  --project=${PROJECT_ID}
```

## Cost Estimation

Cloud Run Jobs pricing (as of 2024):
- **CPU**: ~$0.00002400 per vCPU-second
- **Memory**: ~$0.00000250 per GiB-second
- **Free tier**: 180,000 vCPU-seconds, 360,000 GiB-seconds per month

For a job that runs ~10 seconds daily:
- Monthly executions: 30 times
- Total runtime: ~300 seconds/month
- **Estimated cost**: Free (well within free tier)

Cloud Scheduler:
- **$0.10 per job per month** (first 3 jobs free)

## Troubleshooting

### Job fails with authentication error
- Verify service account has access to the Google Sheet
- Check that the service account email is added as an editor to the sheet

### Job times out
- Increase `--task-timeout` (default is 10 minutes, max is 60 minutes)

### Environment variables not set
- Re-deploy with correct `--set-env-vars` flag
- Verify with: `gcloud run jobs describe ${JOB_NAME} --region=${REGION}`

### Scheduler not triggering
- Check scheduler status: `gcloud scheduler jobs describe sheet-updater-daily --location=${REGION}`
- Verify timezone is correct
- Check IAM permissions for the service account
