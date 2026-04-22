# Tournacent Information Security Policy

Last updated: 2026-04-22 (critical security remediation sprint: consent modal, webhook signature verification, access token AES-256-GCM encryption, data retention cron jobs, delete_user_data RPC, dropout refund logic)

---

## 1. Purpose and Scope

This document identifies information security risks relevant to Tournacent, defines controls to mitigate those risks, and establishes monitoring procedures. It applies to the full Tournacent stack:

- React Native / Expo mobile client
- Supabase backend (PostgreSQL, Auth, Edge Functions, Storage)
- Plaid financial data integration
- EAS build pipeline

This policy applies to all developers, contributors, and any third parties with access to the codebase or infrastructure.

**Related Compliance Documents:**
- **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)** — User-facing privacy terms; required before Plaid deployment
- **[DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md)** — Data retention schedules + deletion procedures; operationalizes this policy's requirements; NY SHIELD Act + CCPA/GDPR compliant
- **[CONSENT_MANAGEMENT.md](CONSENT_MANAGEMENT.md)** — User consent collection workflows, proof of consent (audit trail), withdrawal mechanics; implements CCPA/GDPR/NY SHIELD Act requirements; **CRITICAL before Plaid production**
- **[VENDOR_ASSESSMENT_SUPABASE.md](VENDOR_ASSESSMENT_SUPABASE.md)** — Assessment of Supabase's security controls, certifications (⚠️ no SOC 2), incident response SLAs, GDPR DPA; vendor risk rating and remediation plan
- **[MONEY_TRANSMISSION_COMPLIANCE.md](MONEY_TRANSMISSION_COMPLIANCE.md)** — **🔴 CRITICAL** — FinCEN/NY DFS licensing requirements, KYC/AML obligations, compliance roadmap; **required before accepting real money buy-ins**
- **[RLS_AUDIT_REPORT.md](RLS_AUDIT_REPORT.md)** — Comprehensive audit of Row-Level Security policies; 🟡 **MEDIUM risk** — found design fragility (implicit path format, missing challenge context) but no confirmed bypass vulnerabilities; 4 remediation items identified
- **[DEEP_LINK_SECURITY.md](DEEP_LINK_SECURITY.md)** — Deep link security assessment; 🔴 **HIGH RISK** — custom URL scheme `tournacent://` vulnerable to hijacking; Android App Links + iOS Universal Links implementation guide; invite code validation (HMAC signature + expiration + rate limiting) required

---

## 2. Assets and Data Classification

### Sensitive Data Inventory

| Asset | Sensitivity | Location | Description |
|-------|-------------|----------|-------------|
| Plaid access tokens | Critical | Supabase DB (server-side only) | Used to pull bank transactions; never sent to client |
| Supabase service role key | Critical | Supabase secrets / `.env` | Bypasses RLS; never expose to client |
| User email addresses | High | `auth.users` | Used for authentication |
| Bank transaction data | High | `bank_transactions` table | Real financial history synced from Plaid |
| Account balances | High | `plaid_accounts` table | Current/available balance snapshots |
| Declared no-spend categories | High | `user_no_spend_categories` | Behavioral/financial data |
| Photo evidence uploads | Medium | Supabase Storage (`task-evidence`) | User-uploaded proof images |
| Display names | Low | `profiles` table | Leaderboard-visible |
| Challenge participation | Low | `challenge_participants` table | Points, join status |

### Non-Sensitive Data

- Challenge templates and preset definitions (`lib/presets.ts`)
- Invite codes
- Task titles and descriptions

---

## 3. Threat Model

### 3.1 Authentication Threats

| Threat | Likelihood | Impact | Control |
|--------|-----------|--------|---------|
| Credential stuffing / brute force | Medium | High | Supabase Auth rate limiting; enforce strong password requirements at signup |
| JWT token theft (client device) | Low | High | Tokens stored in `expo-secure-store` (hardware-backed keychain on iOS/Android); never in `AsyncStorage` |
| Unauthorized session reuse | Low | High | Supabase JWT expiry enforced server-side; no custom session persistence |
| Account takeover via email change | Low | High | Email confirmations should remain disabled for dev/test only; enable for production |

### 3.2 API / Backend Threats

| Threat | Likelihood | Impact | Control |
|--------|-----------|--------|---------|
| Unauthorized data access (horizontal privilege escalation) | Medium | High | Row Level Security on all 14 tables; `auth.uid() = user_id` pattern enforced |
| RLS misconfiguration | Low | Critical | All new tables must enable RLS + explicit policies before production deployment; no `DISABLE ROW LEVEL SECURITY` on user-data tables |
| Service role key exposure | Low | Critical | Key lives only in Supabase secrets and CI environment; never committed to source code |
| Edge Function injection (malformed Plaid webhooks) | Low | High | Webhook handler validates `item_id` belongs to a known `plaid_items` row before processing |
| Mass data extraction via missing pagination | Low | Medium | RLS limits queries to own rows; no admin-level listing endpoints on client |

### 3.3 Plaid Integration Threats

| Threat | Likelihood | Impact | Control |
|--------|-----------|--------|---------|
| Plaid access token leakage | Low | Critical | Tokens stored server-side only; `exchange-token` function never returns the access token to the client |
| Replay attacks on `plaid-webhook` | Medium | Medium | Validate `item_id` against `plaid_items`; Plaid webhook signatures should be verified (see §6.1) |
| Sandbox/production environment confusion | Medium | High | `PLAID_ENV` secret controls environment; deploy checklist requires verification before production |
| Over-permissioned Plaid products | Low | Medium | Only `transactions` product used; scope to minimum required |

### 3.4 Mobile Client Threats

| Threat | Likelihood | Impact | Control |
|--------|-----------|--------|---------|
| Secrets hardcoded in app bundle | Low | Critical | Only `EXPO_PUBLIC_SUPABASE_URL` and anon key in client; anon key is safe to expose (RLS enforced) |
| Man-in-the-middle (MITM) | Low | High | Supabase and Plaid communicate over TLS 1.2+; Expo enforces HTTPS; no `NSAllowsArbitraryLoads` |
| Reverse engineering APK to extract API keys | Low | Medium | Anon key by design is public; service role key never in client bundle |
| Malicious photo uploads | Low | Medium | Photos uploaded to user-namespaced path `task-evidence/{userId}/{taskId}`; RLS prevents cross-user access |

### 3.5 Build Pipeline Threats

| Threat | Likelihood | Impact | Control |
|--------|-----------|--------|---------|
| Leaked secrets in git history | Medium | High | `.env` in `.gitignore`; Supabase secrets live in dashboard, not repo |
| Compromised EAS build | Low | High | EAS builds are isolated; no production secrets pass through EAS environment |
| Malicious dependency | Low | High | `package-lock.json` committed and reviewed; `npm audit` run before release builds |

---

## 4. Access Control

### 4.1 Database (Supabase RLS)

All user-data tables must satisfy these requirements:

1. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` — required on every new table
2. A SELECT policy restricting rows to `auth.uid() = user_id`
3. An INSERT policy with `WITH CHECK (auth.uid() = user_id)`
4. No `SECURITY DEFINER` functions that expose cross-user data unless explicitly reviewed

**Current RLS coverage:** 14 of 14 tables (see DATABASE_SCHEMA.md §RLS Summary)

### 4.2 Supabase Roles

| Role | Used by | Permissions |
|------|---------|-------------|
| `anon` | Unauthenticated app users | Read-only on `challenges` where `is_template = true` |
| `authenticated` | Logged-in app users | Own-row CRUD per RLS policies |
| `service_role` | Edge Functions only | Bypasses RLS; used for webhook writes (`bank_transactions`, `plaid_accounts`) |

### 4.3 Storage Bucket

- Bucket: `task-evidence`
- Path convention: `{userId}/{taskId}` — user can only write to paths prefixed with their own UID
- Public read: **disabled** — evidence photos are private
- Max upload size: enforce 10 MB limit in bucket config to prevent storage abuse

### 4.4 Comprehensive Access Control Matrix

#### Supabase Dashboard (Admin Access)

| Role | Access Level | Who | Max Count |
|------|--------------|-----|-----------|
| Owner (all permissions) | Full | Project owner only | 1 |
| Developer (limited) | Logs, migrations, view data | Core team members | 2–3 |
| Viewer (read-only) | Dashboard metrics, logs | QA/analysts | Unlimited |
| No access | — | Contractors, external reviewers | — |

**Enforcement:**
- Use Supabase team invites (dashboard → Settings → Team); no shared accounts
- Enable audit logging in Supabase dashboard (Settings → Logs)
- Revoke dashboard access immediately upon team departure
- Rotate `SUPABASE_ACCESS_TOKEN` after any access revocation

#### Edge Function Secrets (Server-Side Only)

| Secret | Who Can Access | How | Rotation |
|--------|--------|-----|----------|
| `PLAID_CLIENT_ID` | Edge Functions via Supabase secrets | Supabase dashboard → Settings → Secrets | 90 days after any team change |
| `PLAID_SECRET` | Edge Functions via Supabase secrets | Supabase dashboard → Settings → Secrets | 90 days (production); 1 year (sandbox) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Supabase dashboard → Settings → Secrets | On suspected compromise only |

**Enforcement:**
- Never export or print secrets in Edge Function logs
- Validate webhook signatures server-side before trusting input
- Use `DENO_ENV=production` in build profile to gate sensitive logging

#### Storage Bucket Access

| Bucket | Path | Read | Write | Delete |
|--------|------|------|-------|--------|
| `task-evidence` | `{userId}/{taskId}` | User (RLS) | User | Supabase support (manual) |
| `task-evidence` | Other paths | None | None | None |

**Enforcement:**
- No public access URL generation for `task-evidence`
- Bucket policy: deny anonymous reads; only authenticated with matching UID can write
- Max file size: 10 MB per upload
- No executable file types (`.exe`, `.sh`, `.apk`); MIME type validation required

#### Git Repository Access

| Resource | Who | Permissions |
|----------|-----|-------------|
| Source code | All team members | Clone + push (feature branches) |
| Main branch | Project lead | Merge only (code review required) |
| Secrets (`.env`, `.local`) | No one (`.gitignore`) | Never committed |
| Package lock | All team members | Committed; reviewed before merge |

**Enforcement:**
- Require branch protection on `main`: PR review required, status checks pass
- Use GitHub CODEOWNERS to restrict who can approve changes to sensitive files (migrations, Edge Functions)
- Enable audit log export (Settings → Security log) monthly
- Revoke SSH keys / PAT immediately upon team departure

#### Plaid Dashboard Access

| Action | Who | Method |
|--------|-----|--------|
| Link new Plaid account (test) | Developer | Plaid dashboard as `admin` user |
| View transaction history | Developer | Plaid dashboard |
| Rotate production credentials | Project owner | Plaid dashboard (email verification required) |
| View API logs | Developer | Plaid dashboard → Logs |

**Enforcement:**
- Only 1–2 admins on Plaid dashboard
- Enable multi-factor authentication (MFA) on Plaid dashboard
- Use separate Plaid accounts for sandbox vs. production
- Generate API keys as needed; rotate immediately after compromises

#### EAS Build / App Store Access

| Platform | Resource | Who | Controls |
|----------|----------|-----|----------|
| EAS | Build environment | CI/CD only | No secrets in environment; use EAS secrets |
| Apple | App Store Connect | Project lead | Restrict to 2FA-enabled account |
| Google | Play Console | Project lead | Restrict to 2FA-enabled account |

**Enforcement:**
- EAS builds do not have access to `SUPABASE_SERVICE_ROLE_KEY` or `PLAID_SECRET`
- App Store certificates rotated annually
- Play Console service accounts use JSON key files (not passwords)

#### Local Development Environment

| Asset | Control | Verification |
|-------|---------|--------------|
| `.env` file | User-created; in `.gitignore` | `git check-ignore .env` |
| Secrets in code | None hardcoded | Pre-commit hook: `git-secrets` |
| Expo dev server | Local only; no tunnel sharing | `expo.dev --local` (never `--tunnel`) |
| SecureStore (mobile) | Hardware-backed (iOS/Android) | Automatic via Expo SDK |

**Enforcement:**
- Add pre-commit hook to block commits with secrets
- Use `.env.example` (without values) as a template for new developers
- Never share `.env` files via Slack, email, or unencrypted channels

### 4.5 Least Privilege Principle

Every role above has **minimum necessary permissions**:

- Mobile app uses `anon` key (RLS enforces user isolation)
- Edge Functions use `service_role` key **only** for webhook writes
- Developers with dashboard access use `Viewer` role unless making migrations
- No shared accounts or root-level access

**Audit:**
- Monthly: review Supabase dashboard access logs (Settings → Logs)
- Monthly: review Plaid dashboard API logs for suspicious activity
- Quarterly: audit who has access to each platform; remove anyone not actively using it

---

## 5. Secrets Management

### 5.1 What Goes Where

| Secret | Correct Location | Never In |
|--------|-----------------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Client code, `.env`, git |
| `PLAID_CLIENT_ID` | Supabase Edge Function secrets | Client code, git |
| `PLAID_SECRET` | Supabase Edge Function secrets | Client code, git |
| `SUPABASE_ACCESS_TOKEN` | Developer local shell only | git, CI environment variables (use short-lived tokens) |
| `PLAID_ENCRYPTION_KEY` | Supabase Edge Function secrets | Client code, git — **must be set before production; generate with `openssl rand -base64 32`** |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (safe to expose) | — |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` (safe to expose; RLS enforced) | — |

### 5.2 Pre-Commit Checks

Before committing, verify:
```bash
# No secrets in staged files
git diff --staged | grep -iE "(service_role|plaid_secret|access_token|password)" 
```

Add a pre-commit hook or use `git-secrets` to automate this check.

### 5.3 Secret Rotation Schedule

| Secret | Rotation Trigger | Max Lifetime |
|--------|-----------------|-------------|
| Plaid sandbox secret | On team member departure | 1 year |
| Plaid production secret | On team member departure; on suspected leak | 90 days |
| Supabase service role key | On team member departure; on suspected leak | 90 days |
| `PLAID_ENCRYPTION_KEY` | On suspected DB compromise (requires re-encrypting all stored tokens) | — |
| Supabase JWT secret | Only on suspected compromise | — |

---

## 6. Known Gaps and Remediation Plan

### 6.0 Critical Remediation Status

The following table tracks all items that were in the critical category. Items marked ✅ are resolved in code; items marked ⚠️ require organizational action outside the codebase.

| # | Gap | Status | Resolution |
|---|-----|--------|------------|
| 1 | No user consent modal before Plaid Link | ✅ **Fixed** | Consent modal + `user_consents` table: `20260422000003_user_consents.sql`; modal in `wallet.tsx` |
| 2 | User deletion workflow not implemented | ✅ **Fixed** | `delete_user_data()` RPC: `20260422000005_delete_user_data_rpc.sql`; Delete Account button in `wallet.tsx` |
| 3 | No automated data deletion (cron jobs) | ✅ **Fixed** | 4 pg_cron jobs: `20260422000004_data_retention_cron.sql` (sessions, balances, challenge anonymization, withdrawn consents) |
| 4 | Plaid access token not encrypted at rest | ✅ **Fixed** | AES-256-GCM encryption in `exchange-token/index.ts`; decryption in `sync-transactions/index.ts` and `plaid-webhook/index.ts`. Format: `enc:v1:<base64(iv‖ct)>` |
| 5 | Plaid webhook signatures not verified | ✅ **Fixed** | RS256 JWT verification + body SHA-256 hash check + 5-min freshness window in `plaid-webhook/index.ts`; sandbox bypasses verification (Plaid doesn't sign sandbox events) |
| 6 | No buy-in refund on dropout | ✅ **Fixed** | `drop_out_of_challenge()` now inserts `refund` transaction and decrements `prize_pool`: `20260422000006_drop_out_refund.sql` |
| 7 | No privacy policy deployed (UI) | ⚠️ **Org action** | `PRIVACY_POLICY.md` written; Privacy Policy link in wallet.tsx opens `https://tournacent.com/privacy`; URL must be live before production |
| 8 | Data retention not enforced in Supabase backups | ⚠️ **Org action** | Configure Supabase backup retention to 30 days in Dashboard → Settings → Backups |
| 9 | No DPO / privacy contact assigned | ⚠️ **Org action** | Assign `privacy@tournacent.com` and `dpo@tournacent.com` inboxes; monitor daily |
| 10 | No third-party security audit scheduled | ⚠️ **Org action** | Schedule Q3 2026; use firm with financial data / SOC 2 experience |
| 11 | Email confirmation disabled | ⚠️ **Org action** | Re-enable in Supabase Dashboard → Auth → Settings → Email Confirmation |
| 12 | No real payment processing | ⚠️ **Org action** | Stripe integration required before public launch; current buy-in is simulated |
| 13 | `PLAID_ENCRYPTION_KEY` secret not yet set | ⚠️ **Org action** | Run `openssl rand -base64 32` and add to Supabase Dashboard → Settings → Secrets; without this key, access tokens are stored in plaintext (the code warns but degrades gracefully) |

### 6.1 Critical (remaining — resolve before production)

All code-resolvable critical items are now fixed (see §6.0). The following require organizational action:

| Gap | Risk | Action Required |
|-----|------|----------------|
| **Privacy policy not live at URL** | Plaid requires accessible privacy policy; CCPA/GDPR violation | Deploy `PRIVACY_POLICY.md` content to `https://tournacent.com/privacy` |
| **Supabase backup retention unconfigured** | Deleted data survives in backups beyond policy limits | Dashboard → Settings → Backups → set retention to 30 days |
| **No DPO / privacy contact** | Cannot respond to GDPR/CCPA requests within required timelines | Assign email inboxes; document response SLAs |
| **No third-party audit** | NY SHIELD Act "reasonable security" requires documented audit | Book Q3 2026; document scope and findings |
| **Email confirmation disabled** | Account creation with unowned emails | Re-enable in Supabase Auth settings |
| **No real payment processing** | App cannot charge real buy-ins | Stripe integration (major feature, out of scope for this sprint) |
| **`PLAID_ENCRYPTION_KEY` not set** | Access tokens stored in plaintext if secret absent | Add to Supabase secrets before any production Plaid linking |

### 6.2 High Priority — Remediation Status

| Gap | Status | Resolution |
|-----|--------|------------|
| No GitHub branch protection on `main` | ✅ **Partial** | `.github/CODEOWNERS` created — requires owner to enable branch protection rules in GitHub Settings → Branches |
| No pre-commit hook for secrets | ✅ **Fixed** | `.githooks/pre-commit` created; activated via `npm run prepare` (`git config core.hooksPath .githooks`) |
| Supabase audit logging not enabled | ⚠️ **Org action** | Enable in Supabase Dashboard → Settings → Logs; export monthly |
| No MFA on admin accounts | ⚠️ **Org action** | Enable TOTP/hardware key on Supabase, Plaid, App Store, GitHub accounts |
| No secret rotation schedule enforcement | ⚠️ **Org action** | Documented in §5.3; enforce 90-day rotation for production secrets on team departure |
| No team member revocation playbook | ⚠️ **Org action** | Process: disable Supabase access → revoke GitHub SSH keys → rotate Plaid/Supabase secrets → remove from app store; execute within 24 hours of departure |
| No certificate pinning | ⚠️ **Deferred (Phase 3)** | Expo managed workflow does not support native cert pinning without ejecting or a custom config plugin; defer until bare workflow migration |
| No rate limiting on Edge Functions | ✅ **Already done** | `sync-transactions` enforces 1-hour cooldown per user (`MANUAL_SYNC_COOLDOWN_MS`); bypass only with `force=true` (post-link) |
| No input sanitization on form submissions | ✅ **Fixed** | `KNOWN_FORM_IDS` allowlist added to `FormModal.tsx`; string fields truncated; DB `CHECK` constraint on `form_id`: `20260422000007_form_id_constraint.sql` |
| Photo upload type not validated | ✅ **Fixed** | `tasks.tsx` and `CounterModal.tsx` now validate `mimeType` from ImagePicker against allowlist `[image/jpeg, image/png, image/heic, image/heif, image/webp]` before upload; actual MIME passed to Storage |
| No password reset flow | ✅ **Fixed** | `app/(auth)/forgot-password.tsx` created; "Forgot password?" link added to `login.tsx`; uses `supabase.auth.resetPasswordForEmail()` with deep-link redirect |
| Pending challenge auto-cancel missing | ✅ **Already done** | `cancel_expired_pending_challenges()` pg_cron job exists in `20260401000003_cron_automation.sql` (runs every 30 min) |

### 6.3 Medium Priority (post-launch hardening)

| Gap | Risk | Remediation |
|-----|------|-------------|
| No audit log for admin actions | No traceability for data corrections | Add `audit_log` table written by service role for sensitive operations |
| No push notification security | Deep links could be spoofed | Validate deep link `invite_code` server-side before acting (already done in `join/[code].tsx`) |
| App Store / Play Store links are placeholders | Users directed to non-existent pages | Update invite message URLs before app store submission |

---

## 7. Incident Response

### 7.1 Suspected Credential Leak

1. Immediately rotate the compromised credential (Supabase dashboard → Settings → API or Plaid dashboard)
2. Review Supabase logs (Dashboard → Logs → Edge Functions + Database) for anomalous queries in the past 30 days
3. If bank data accessed: notify affected users and follow applicable state breach notification laws
4. Document the incident: what was exposed, how long, and what was done

### 7.2 Unauthorized Data Access Detected

1. Identify the affected user IDs via Supabase logs
2. If RLS was bypassed: disable the affected table's anon/authenticated policies temporarily while investigating
3. Patch the RLS policy and redeploy
4. Notify affected users if their financial data was accessed

### 7.3 Contacts

| Role | Responsibility |
|------|---------------|
| Project Owner | Credential rotation, Supabase/Plaid dashboard access |
| Lead Developer | Code patches, Edge Function redeployment |
| Plaid Support | `support@plaid.com` — report compromised Plaid credentials |
| Supabase Support | `support@supabase.io` — report suspected DB breach |

---

## 8. Security Review Checklist

Run this checklist before each release build:

### Code
- [ ] No secrets committed to git (`git log --all -S "service_role"`)
- [ ] All new DB tables have RLS enabled with explicit policies
- [ ] No `SECURITY DEFINER` functions added without review
- [ ] Plaid access tokens never returned to client in any Edge Function response
- [ ] Photo uploads stored under `{userId}/` path prefix
- [ ] `npm audit` run; no high/critical vulnerabilities without mitigation

### Configuration
- [ ] `PLAID_ENV` is set to `production` (not `sandbox`) in production secrets
- [ ] `PLAID_ENCRYPTION_KEY` is set in Supabase Edge Function secrets (verify: `supabase secrets list`)
- [ ] Email confirmation enabled in Supabase Auth settings
- [ ] `task-evidence` storage bucket is private (no public URL access)
- [ ] Service role key not present in `.env` or any client-accessible config
- [ ] Privacy policy live at `https://tournacent.com/privacy`

### Build
- [ ] EAS build uses production environment variables
- [ ] APK/IPA does not include `.env` file or service role key
- [ ] `npm run typecheck` passes with no errors

---

## 9. Monitoring

### What to Watch

| Signal | Where to Look | Frequency |
|--------|--------------|-----------|
| Failed authentication attempts | Supabase Dashboard → Auth → Logs | Weekly |
| Edge Function errors | Supabase Dashboard → Edge Functions → Logs | After each deploy + weekly |
| Unexpected `bank_transactions` inserts | Supabase Database → `bank_transactions` | Monthly |
| Storage usage spike | Supabase Dashboard → Storage | Monthly |
| Plaid sync errors | Edge Function logs for `plaid-webhook` | After webhook deployments |
| RLS policy test | Run `supabase db lint` | Before each migration push |

### Alerting (future)

Once the app is in production, configure:
- Supabase log drain to a monitoring service (e.g., Datadog, Logtail)
- Alert on Edge Function error rate > 5% over 10 minutes
- Alert on `bank_transactions` insert volume spike (> 500 rows/hour per user)

---

## 10. Compliance Considerations

Tournacent processes real bank transaction data via Plaid. Before charging real money or storing production bank data:

| Requirement | Notes |
|-------------|-------|
| Plaid Developer Agreement | Must be accepted in Plaid dashboard before leaving sandbox |
| Plaid Production Access | Requires Plaid review; submit application at dashboard.plaid.com |
| State money transmission laws | Buy-in pooling may constitute money transmission in some states; consult legal counsel |
| CCPA (California) | If serving California residents: provide data deletion capability and privacy policy |
| COPPA | App must not be directed at users under 13; add age gate at signup |
| PCI DSS | Not applicable while buy-in is simulated; required if storing payment card data |
