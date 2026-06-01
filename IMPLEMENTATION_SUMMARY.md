# Tournacent Implementation Summary

Last updated: 2026-04-21

---

## Project Overview

Tournacent is a financial literacy challenge app built with Expo Router + Supabase. Users create or join challenges, complete real financial tasks (saving, tracking, no-spend streaks, debt repayment, investing), and compete for a pooled prize.

**Current Status:** Full verification pipeline implemented across all 7 verification types. Plaid savings + debt accounts connected and driving task verification. Simulated payments for user testing. Challenge completion summary graphics, age-gated signup (13+), password reset flow, and Mini Rate Check challenge all implemented.

---

## Architecture

### Frontend
- **Expo Router v6** — file-based routing, Stack + Tab navigators
- **React Native + TypeScript** — mobile-first, portrait orientation
- **Bottom tabs:** Home, Tasks, Wallet, Leaderboard
- **Deep links:** `tournacent://join/TC-XXXX` → `app/join/[code].tsx`

### Backend (Supabase)
- **PostgreSQL** with Row Level Security on all tables
- **Supabase Auth** — email/password, JWT sessions
- **Edge Functions (Deno)** — 4 functions deployed: `create-link-token`, `exchange-token`, `sync-transactions`, `plaid-webhook`
- **DB Triggers** — auto-activation of group challenges at 3 participants
- **pg_cron** — daily no-spend streak evaluation
- **RPC Functions** — `generate_invite_code()`, `get_challenge_by_invite_code()`

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User display name, avatar |
| `challenges` | Challenge instances + templates |
| `challenge_participants` | Who joined what, points, payment_status, dropped_out_at |
| `tasks` | Tasks per challenge (with `verification_type` + `form_id`) |
| `task_completions` | Audit trail of completed tasks (includes `evidence_url` for photos) |
| `transactions` | Buy-in / payout / refund records |
| `plaid_items` | Linked bank accounts; `item_type` = `savings` or `debt`; unique on `(user_id, item_type)` |
| `bank_transactions` | Raw transactions synced from Plaid; stamped with `item_type` |
| `plaid_accounts` | Per-account balance snapshot (refreshed after every debt webhook sync) |
| `user_no_spend_categories` | 3 declared Plaid categories per user per challenge |
| `task_form_submissions` | Persisted form data from the 7 FormModal types |
| `task_quiz_submissions` | Quiz answers, score, and profile label |
| `task_counters` | Single-row progress counter per user per task |
| `task_text_submissions` | Free-text responses with word count |

---

## Key Architecture Decision: task_type vs. verification_type

`task_type` and `verification_type` are deliberately separated:

- **`task_type`** — drives color-coding on the task card only (`savings` = violet, `no_spend` = lime green, etc.)
- **`verification_type`** — drives all completion behavior: which modal opens, what DB writes happen, what validation is enforced

This means a "budget" task (blue) might use `form` verification, a "reading" task (green) might use `quiz` verification, and so on. The two are fully independent.

---

## Authentication Features

### Age Gate (COPPA Compliance)
- **Signup**: Three separate TextInput fields for MM/DD/YYYY with auto-advance
- **Validation**: `calculateAge()` function guards against JavaScript date rollover (e.g., Feb 31 → Mar 3)
- **Enforcement**: Database CHECK constraint on `profiles.date_of_birth`: minimum 13 years old (ISO format)
- **Migration**: `20260422000008_add_date_of_birth.sql`

### Password Reset
- **Flow**: "Forgot password?" link on login screen → email reset → deep-link redirect
- **Implementation**: `app/(auth)/forgot-password.tsx` uses `supabase.auth.resetPasswordForEmail()` with `redirect_uri: 'tournacent://reset-password'`
- **Navigation**: Deep link redirects to password reset UI after email confirmation

---

## Verification Pipeline

### `plaid` tasks
`lib/task-verification.ts` → `verifyTaskCompletion()` → branches by `task_type`:
- **Savings tasks**: sum all positive `bank_transactions` since challenge start; check against milestone ($25 / $100 / $250)
- **No-spend tasks**: check for any transaction in declared categories since last streak reset → call `breakStreak()`
- **Debt payment tasks**: sum negative `bank_transactions` on `item_type='debt'` account; "Pay Off One Debt" reads `plaid_accounts.current_balance ≤ 5`

### `photo` tasks
Image picker → JPEG upload to `task-evidence/{userId}/{taskId}` → path stored in `task_completions.evidence_url`

### `self_report` tasks
One-tap confirm; no external check.

### `form` tasks
`FormModal` (`components/FormModal.tsx`) loads form by `task.form_id`. Seven forms:

| form_id | Inputs | Output |
|---------|--------|--------|
| `apr_calculator` | Balance, APR%, min payment | Monthly interest, months to payoff, total interest |
| `debt_avalanche` | Dynamic debt rows (name, balance, APR) | Sorted payoff order by APR desc |
| `investment_goal` | Target amount, years (≥5) | Stored goal |
| `etf_research` | 3 ETFs: ticker + rationale (≥50 words each) | Ticker + rationale per ETF |
| `bill_audit` | Dynamic bill rows (≥5): provider, rate, end date | Full bill list |
| `annual_savings` | Dynamic rows: provider, old rate, new rate | Auto-computed annual total |
| `compound_growth` | Principal, monthly contribution, rate, years | Real-time year-by-year projection table |

All submissions written to `task_form_submissions`.

### `quiz` tasks
`QuizModal` (`components/QuizModal.tsx`) loads quiz definition from `QUIZZES[task.form_id]` in `lib/quizzes.ts`.

Risk Assessment Quiz: 10 questions, 4 choices (scored 1–4), total range 10–40. Five profiles:
- Conservative (10–15), Moderately Conservative (16–21), Moderate (22–27), Moderately Aggressive (28–33), Aggressive Growth (34–40)

Profile card displayed before submit once all 10 questions answered. Written to `task_quiz_submissions`.

### `counter` tasks
`CounterModal` (`components/CounterModal.tsx`). Target parsed from title: `/(\d+)\s*times?/i`. Each tap upserts `task_counters`. Photo evidence required at target. Live progress bar + count shown on task card.

### `text` tasks
`TextEntryModal` (`components/TextEntryModal.tsx`). Word minimum parsed from description: `/(\d+)\+?\s*words?/i`. Live word count displayed. Written to `task_text_submissions`.

---

## Plaid Integration

### Multi-Account Support
One savings account + one debt account per user. `plaid_items.item_type` distinguishes them; unique constraint on `(user_id, item_type)`.

### Edge Functions
- **`create-link-token`** — generates Plaid Link token; includes `redirect_uri` for OAuth banks on web
- **`exchange-token`** — exchanges public token; accepts `item_type`; upserts on `(user_id, item_type)`
- **`sync-transactions`** — accepts `item_type`; fetches incremental transactions using cursor; stamps all rows with `item_type`
- **`plaid-webhook`** — handles `SYNC_UPDATES_AVAILABLE` events; routes by `item_type`:
  - Savings: syncs transactions → checks no-spend violations (user's declared categories)
  - Debt: syncs transactions → checks spending freeze violations (>$50 purchase breaks streak) → calls `refreshAccountBalances()` to update `plaid_accounts`

### Task Verification
`lib/task-verification.ts` reads `bank_transactions` to auto-complete Plaid tasks. The function `verifyTaskCompletion()` is called when user taps a `verification_type='plaid'` task, runs the check, and either marks complete or returns a failure message.

---

## Mini Rate Check Challenge

**New 7-day preset challenge** focused on bill negotiation and rate creep detection.

### Mandatory Tasks (100 points)
1. **Identify 3 Recurring Charges or Rate Creep** (20 pts) — Free selection from transaction history; >5% annual increase flagged as rate creep
2. **Research Competitor Market Rates** (20 pts) — Screenshot URLs of competitor pricing for 3+ services
3. **Call to Negotiate or Cancel** (25 pts) — Screenshot of call log with date and provider
4. **Confirm Action Completed** (20 pts) — Screenshot of cancellation, refund, or new rate documentation
5. **Create Social Media Share Graphic** (15 pts) — `SocialMediaShareModal` generates card showing negotiated services, rates, and monthly savings; user screenshots for verification

### Optional Tasks (up to 125 points)
- Negotiate 2nd/3rd service (25 pts each)
- Get 3+ confirmed rate reductions (25 pts)
- Switch provider for savings (25 pts)
- Automate savings from negotiation (25 pts)

### 24-Hour Minimum Enforcement
- Blocks completion of all 5 mandatory tasks within first 24 hours of challenge start
- Prevents speed-running; enforced in `app/(tabs)/tasks.tsx` `handleCompleteTask()`

### Social Media Graphics Component
- `SocialMediaShareModal` (`components/SocialMediaShareModal.tsx`) — users enter service names and rate changes
- Generates visual card showing service negotiation summary with color-coded savings
- Displays real-time monthly and total savings calculations
- User screenshots graphic for task verification (photo upload)

---

## Challenge Completion Graphics

**Auto-displays on leaderboard when challenge naturally ends.**

### ChallengeCompletionGraphic Component
- `components/ChallengeCompletionGraphic.tsx` — fetches challenge, task completions, and calculates metrics
- Card-based layout with theme colors: header (primary green), score card, tasks breakdown, impact metrics, optional leaderboard rank
- **Metrics calculated by challenge type:**
  - Debt Destroyer: $XXX paid toward debt (~$3.50/point)
  - Investment Starter: $XXX invested (~$4/point)
  - Bill Negotiation: $XXX/year saved (~$24/point annually)
  - No-Spend Reset: $XXX saved (~$2.50/point)
  - Emergency Fund Sprint: $XXX saved (~$2/point)
  - Mini Rate Check: $XXX/month saved (~$3/point)

### Sharing
- Native share sheet (SMS, email, social media, AirDrop)
- Copy to clipboard: formatted summary text with score, tasks completed, time, and estimated impact

---

## Key Flows

### Solo Challenge
1. User browses templates → selects challenge → taps "Solo"
2. New challenge instance created (`challenge_type = 'solo'`, `status = 'active'`)
3. Tasks copied from template (including `verification_type` and `form_id`)
4. User added as participant with `payment_status = 'paid'`

### Task Completion by Type

```
User taps task
  ├── no_spend_declare → category picker modal (3 categories to Plaid)
  ├── verification_type = 'plaid' → run verifyTaskCompletion() → mark complete or show error
  ├── verification_type = 'photo' → image picker → upload → mark complete
  ├── verification_type = 'form' → FormModal(form_id) → compute → submit → task_form_submissions
  ├── verification_type = 'quiz' → QuizModal(form_id) → answer → profile → task_quiz_submissions
  ├── verification_type = 'counter' → CounterModal → +/- → photo at target → task_counters
  ├── verification_type = 'text' → TextEntryModal → live word count → task_text_submissions
  └── verification_type = 'self_report' → confirm modal → mark complete
```

---

## File Structure

```
app/
  _layout.tsx              # Root Stack + AuthProvider
  index.tsx                # Auth gate
  join/[code].tsx          # Invite deep-link handler (anon-safe)
  (auth)/
    login.tsx
    signup.tsx
  (tabs)/
    _layout.tsx            # Bottom tabs
    index.tsx              # Home: active challenge, pending, buy-in states
    tasks.tsx              # Task list + all 7 verification modal routes
    wallet.tsx             # Buy-in, Plaid link (savings + debt), transactions
    leaderboard.tsx        # Live rankings
    browse.tsx             # Challenge browser

components/
  PlaidLink.tsx                    # Plaid Link WebView
  FormModal.tsx                    # 7 in-app form types (form verification)
  QuizModal.tsx                    # Generic quiz renderer (quiz verification)
  CounterModal.tsx                 # +/− counter with photo evidence (counter verification)
  TextEntryModal.tsx               # Free-text entry with live word count (text verification)
  SocialMediaShareModal.tsx        # Social media graphic generator (Mini Rate Check challenge)
  ChallengeCompletionGraphic.tsx   # Challenge completion summary (auto-displays on challenge end)
  ui/
    Button.tsx
    Card.tsx
    ProgressBar.tsx

contexts/
  AuthContext.tsx
  ThemeContext.tsx

hooks/animations/
  useLeaderboardReorder.ts
  useScalePress.ts
  useSwipeAction.ts

lib/
  supabase.ts              # Supabase client + SecureStore adapter
  plaid.ts                 # Plaid API (savings + debt accounts)
  task-verification.ts     # Plaid-backed task verification logic
  presets.ts               # 6 preset challenges; all tasks typed with verification_type + form_id
  quizzes.ts               # Generic quiz registry (QUIZZES record keyed by quiz_id)

constants/
  tokens.ts

supabase/
  migrations/              # 25 migrations, all pushed
  functions/
    create-link-token/index.ts
    exchange-token/index.ts
    sync-transactions/index.ts
    plaid-webhook/index.ts
```

---

## Known Issues / Missing Features

### Critical (blocks production)
1. **Stripe webhook not registered** — Register `https://kqbxkeqyjrczvgksuyox.supabase.co/functions/v1/stripe-webhook` in Stripe Dashboard → Webhooks, then add `STRIPE_WEBHOOK_SECRET` to Supabase Secrets and redeploy `stripe-webhook`
2. **pg_net app settings not configured** — Run once in Supabase SQL Editor so pg_cron can trigger payouts:
   ```sql
   ALTER DATABASE postgres SET app.supabase_url = 'https://kqbxkeqyjrczvgksuyox.supabase.co';
   ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
   ```
3. **Stripe Connect not enabled** — Enable Connect in Stripe Dashboard before users can receive payouts

### Medium Priority
3. **App icon placeholder** — Default Expo template icon (UX only)
4. **App Store URLs placeholder** — Invite message links to fake store URLs (blocks production launch)

### Low Priority (future)
5. No push notifications (UX feature)
6. No in-app social features beyond challenge invites
7. No admin dashboard (operational feature)

---

## Stripe Payment Integration

**Status:** Scaffolded — all code written, requires manual Stripe account setup to activate.

### Architecture
- **Buy-in flow:** `create-payment-intent` edge function → Stripe PaymentSheet (native modal) → `stripe-webhook` confirms `payment_intent.succeeded` → updates `payment_status = 'paid'`, inserts buy_in transaction
- **Payout flow:** `process_completed_challenges` pg_cron inserts payout rows (status=`pending`) → calls `payout-winner` edge function via `pg_net.http_post` → Stripe Transfers API → marks transactions `verified` with `stripe_transfer_id`
- **Winner onboarding:** `create-stripe-account` → Stripe Express account → account link URL → user completes in browser → `account.updated` webhook sets `stripe_onboarding_complete = true`

### New Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `create-payment-intent` | User taps Confirm Buy-In | Creates Stripe PaymentIntent, returns client_secret |
| `create-stripe-account` | User taps Set Up Payout Account | Creates Stripe Express account, returns onboarding URL |
| `payout-winner` | pg_cron via pg_net | Reads pending payout rows, executes Stripe Transfers |
| `stripe-webhook` | Stripe events | Confirms payments, updates onboarding status |

### Schema Additions
- `profiles.stripe_account_id` — Stripe Connect Express account ID
- `profiles.stripe_onboarding_complete` — whether user can receive payouts
- `challenge_participants.stripe_payment_intent_id` — for reconciliation
- `transactions.stripe_transfer_id` — populated after Stripe payout

### Manual Setup Required
See "What You Need to Do" section below.

---

### Resolved ✅
- Email confirmation disabled for dev/test (re-enable before production)
- Auto-cancel cron jobs for pending/buy-in-expired challenges (via pg_cron)
- Buy-in refund on dropout (migration `20260422000006`)
- Prize payout logic (pg_cron `process_completed_challenges` in migration `20260401000003`)
- Password reset flow (deep-link email reset)
- Age gate for COPPA (13+ minimum, database constraint)

---

## Build Commands

```bash
# Dev server (Windows)
node_modules/.bin/expo.cmd start --web --port 8081

# TypeScript check
npm run typecheck

# APK for testers
eas build --platform android --profile preview

# Push DB migrations
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe db push

# Deploy edge functions
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy create-link-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy exchange-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy sync-transactions
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy plaid-webhook
```
