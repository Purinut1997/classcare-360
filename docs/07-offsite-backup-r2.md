# Encrypted off-site backups to Cloudflare R2

ClassCare 360 can create daily encrypted logical backups from GitHub Actions and store them in a private Cloudflare R2 bucket. The workflow writes a snapshot every day at 02:17 Asia/Bangkok (19:17 UTC), supports a manual run, and prunes objects older than 30 days. It never commits backup data to Git.

Each snapshot contains Supabase CLI role, schema, and data dumps plus copies of Storage objects. Supabase's documented data dump can include `auth.users` rows and password hashes. Treat the decrypted archive as highly sensitive student and account data. The CLI backup excludes vector tables that Supabase documents as non-restorable from this dump.

## Provisioning checklist

### 1. Create a private R2 bucket

In Cloudflare, create a private Standard bucket for ClassCare backups. Create one bucket-scoped R2 token with **Object Read & Write** for GitHub Actions and a separate bucket-scoped **Object Read** token for the Superadmin Edge Function. The backup runner also deletes expired objects, so its token needs delete capability. Do not enable public access.

R2 includes a monthly free allowance for Standard storage and operations; usage above the allowance is billed. See [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

### 2. Create the encryption key pair

Use the official `age` tool on a trusted computer to create an X25519 key pair. Put the public `age1...` recipient in GitHub Actions secret `BACKUP_AGE_RECIPIENT`; put the private `AGE-SECRET-KEY-1...` identity in `BACKUP_AGE_IDENTITY`. Never commit either key. The private identity is only used by the recovery workflow.

### 3. Add GitHub repository secrets and variables

In GitHub → **Settings → Secrets and variables → Actions**, add:

| Name | Type | Purpose |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Secret | Source database session-pooler URL; use the pooler because GitHub runners use IPv4 |
| `SUPABASE_URL` | Secret | Source Supabase project URL for Storage API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Read all Storage buckets and objects for backup |
| `R2_ACCOUNT_ID`, `R2_BUCKET` | Secrets | Private R2 destination |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Secrets | Bucket-scoped R2 read/write key for backup and retention |
| `BACKUP_AGE_RECIPIENT` | Secret | Public age key used to encrypt archives |
| `SUPABASE_RECOVERY_DB_URL` | Secret | Database URL of a separate, empty recovery Supabase project |
| `SUPABASE_RECOVERY_URL` | Secret | URL of that recovery project |
| `SUPABASE_RECOVERY_SERVICE_ROLE_KEY` | Secret | Restore Storage objects into the recovery project |
| `BACKUP_AGE_IDENTITY` | Secret | Private age key used only by the recovery workflow |
| `SUPABASE_ACCESS_TOKEN` | Secret | Fine-grained token used by the manual Edge Function deploy workflow |

Add these repository variables:

| Name | Purpose |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Project ref that hosts ClassCare and its Edge Function |
| `SUPABASE_SOURCE_PROJECT_REF` | Production source project ref |
| `SUPABASE_RECOVERY_PROJECT_REF` | Separate recovery project ref; must differ from the source ref |

Use the database **Session pooler** connection string from Supabase's Connect panel. The database password is part of this GitHub secret; never paste it into chat, logs, a workflow file, or the repository.

### 4. Deploy the Superadmin API

Create a GitHub fine-grained token limited to this repository with Actions write permission. Store it as Supabase Edge Function secret `GITHUB_ACTIONS_TOKEN`. Add the Edge Function secrets `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_READ_ACCESS_KEY_ID`, `R2_READ_SECRET_ACCESS_KEY`, `GITHUB_REPOSITORY_OWNER=Purinut1997`, and `GITHUB_REPOSITORY_NAME=classcare-360` in Supabase. Keep the R2 read token separate from the GitHub backup writer token.

Run GitHub Actions → **Deploy R2 backup control function**. `SUPABASE_ACCESS_TOKEN` must be permitted to deploy Edge Functions for this project. The function verifies the caller's Supabase session and Superadmin role before listing backup metadata or dispatching recovery.

### 5. Enable approval for recovery runs

In GitHub → **Settings → Environments**, create `backup-recovery` and require a reviewer before jobs can use its recovery database secrets. Protect the `main` branch so unreviewed workflow changes cannot access backup credentials.

Run **Encrypted off-site database backup** manually once. Confirm a `.tar.gz.age` object and checksum object appear under `backups/` in R2, then confirm the app lists that backup. Scheduled runs use GitHub Actions cron; GitHub may delay scheduled jobs during high load, so monitor failed or missed runs.

## Recovery behavior and limits

- A Superadmin restore request dispatches `restore-from-r2.yml`. GitHub pauses at the protected `backup-recovery` environment before using recovery project secrets.
- The workflow restores into a separate recovery project. It does not overwrite production. Validate sign-in, workspaces, students, attendance, scores, reports, and Storage objects in recovery before planning a production cutover.
- Database and Storage objects are snapshot copies. Files created after the selected snapshot are absent from the recovery copy. R2 retention is 30 days; workflow failures appear in GitHub Actions.
- Restoring a snapshot is not point-in-time recovery. Changes since the snapshot are not present. A production cutover is a separate operation and should be planned and approved after recovery validation.
- A completed dump is not proof that the snapshot can be restored. Perform a recovery drill in the isolated project before relying on the workflow for an incident.

## Secrets used by the Superadmin Edge Function

```text
R2_ACCOUNT_ID
R2_BUCKET
R2_READ_ACCESS_KEY_ID
R2_READ_SECRET_ACCESS_KEY
GITHUB_REPOSITORY_OWNER
GITHUB_REPOSITORY_NAME
GITHUB_ACTIONS_TOKEN
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by Supabase Edge Functions. Never expose R2 keys, database URLs, service-role keys, the GitHub token, or the age identity in Vite/browser variables.
