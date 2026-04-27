# Deployment Notes

## Production architecture

This app has two required production components:

1. **Web app** on Vercel
2. **Worker service** running continuously for async scoring jobs

The web app alone is not enough for behavioural interview scoring.

## Behavioural interview scoring flow

1. User completes interview in the web app
2. `POST /api/interviews/[interviewId]/complete` inserts a `score_interview` job into `jobs`
3. Separate worker service polls the `jobs` table
4. Worker runs `worker/src/jobs/scoreInterview.ts`
5. Worker writes results to `interview_scores`
6. Report page stops showing `pending` and renders scored output

## Production services

### Vercel
- Hosts the Next.js web app
- Repo: `beruldsen/ai-assessment-app`

### Railway
- Hosts the long-running worker service
- Railway project: `imaginative-forgiveness`
- Root directory: `worker`
- Start command: `npm start`

## Railway environment variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Recommended:
- `WORKER_ID=prod-worker-1`
- `POLL_INTERVAL_MS=2000`

## Important reminder

If interview reports stay stuck at `pending`, check the Railway worker first.

Typical causes:
- worker service offline
- wrong Railway root directory
- wrong start command
- missing env vars
- worker deploy failed

## Jobs table compatibility

A compatibility migration was added for the worker/jobs schema:
- `sql/2026-04-27_jobs_error_last_error_compat.sql`

This ensures the `jobs` table supports both older and newer worker fields:
- `error`
- `last_error`
- `locked_at`
- `locked_by`
- `attempts`

Apply it in production/staging if missing.
