# Tournacent Implementation Summary

Last updated: 2026-04-01

---

## Project Overview

Tournacent is a financial literacy challenge app built with Expo Router + Supabase. Users create or join challenges, complete real financial tasks (saving, tracking, no-spend streaks), and compete for a pooled prize.

**Current Status:** User-testing ready with simulated payments. Real payment processing and Plaid bank verification are planned but not yet active.

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
- **Edge Functions (Deno)** — 3 Plaid functions written but not yet deployed
- **DB Triggers** — auto-activation of group challenges at 3 participants
- **RPC Functions** — `generate_invite_code()`, `get_challenge_by_invite_code()`

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User display name, avatar |
| `challenges` | Challenge instances + templates |
| `challenge_participants` | Who joined what, points, payment_status, dropped_out_at |
| `tasks` | Tasks per challenge |
| `task_completions` | Audit trail of completed tasks |
| `transactions` | Buy-in / payout / refund records |
| `plaid_items` | Linked bank accounts (access token stored server-side) |
| `bank_transactions` | Raw transactions synced from Plaid |

### Key Columns Added (migrations 20260329*)

| Column | Table | Purpose |
|--------|-------|---------|
| `challenge_type` | challenges | `'solo'` or `'group'` |
| `is_template` | challenges | Preset library entries shown in Browse |
| `invite_code` | challenges | Human-readable `TC-XXXX` code |
| `pending_expires_at` | challenges | 48h window for group to recruit 3 players |
| `buyin_deadline` | challenges | 48h after activation to pay buy-in |
| `join_deadline` | challenges | 48h after activation to join |
| `payment_status` | challenge_participants | `'pending'` or `'paid'` |
| `dropped_out_at` | challenge_participants | Timestamptz set on dropout (soft-delete); `NULL` = active participant |

### Challenge Status Lifecycle

```
[template]
    ↓  (user creates group challenge)
 pending  ──(3 players join)──→  active  ──(end_date reached)──→  completed
    ↓                               ↓
 (48h no 3 players)          (buy-in deadline, < 3 paid)
    ↓                               ↓
 cancelled                      cancelled   ← (not yet automated server-side)
```

---

## Key Flows

### Solo Challenge
1. User browses templates → selects challenge → taps "Solo"
2. New challenge instance created (`challenge_type = 'solo'`, `status = 'active'`)
3. Tasks copied from template to new challenge
4. User added as participant with `payment_status = 'paid'`
5. Home screen shows active challenge immediately

### Group Challenge
1. User taps "Group" → sees 3-player minimum info
2. `generate_invite_code()` RPC generates unique `TC-XXXX` code
3. New challenge created with `status = 'pending'`, `pending_expires_at = now() + 48h`
4. Tasks copied from template
5. Native `Share.share()` opens OS share sheet with invite message
6. Friends receive link → open `https://tournacent.app/join/TC-XXXX`
7. `get_challenge_by_invite_code()` RPC (anon-safe) returns challenge preview
8. Unauthenticated friends prompted to sign up; authenticated friends join directly
9. `on_participant_joined` trigger fires on each INSERT to `challenge_participants`
10. When participant count hits 3: challenge status → `active`, `buyin_deadline` and `join_deadline` set to `now() + 48h`
11. Each participant sees "Buy-In Required" on Home + Wallet screens
12. Confirming buy-in: `payment_status → 'paid'`, `prize_pool` incremented, transaction recorded

### Buy-In (Simulated — Option A)
- Tapping "Confirm Buy-In" updates `challenge_participants.payment_status = 'paid'`
- Increments `challenges.prize_pool` by `buy_in_amount`
- Inserts a `transactions` record with `status = 'verified'`
- **No real money moves.** This is intentional for user testing. Stripe or ACH needed for production.

---

## RLS Policies

| Policy | Table | Rule |
|--------|-------|------|
| Users can view their own data | all tables | `user_id = auth.uid()` |
| Authenticated users can view active challenges | challenges | `status = 'active'` |
| Users can view challenge templates | challenges | `is_template = true` |
| Organizers can view own challenges | challenges | `organizer_id = auth.uid()` |
| Users can view group challenges by invite code | challenges | `invite_code IS NOT NULL AND status IN ('pending','active')` |
| Participants can view their challenge | challenge_participants | `user_id = auth.uid()` |
| Active-only participant queries | challenge_participants | Client-side: `.is('dropped_out_at', null)` filter on all home/tasks/leaderboard fetches |

---

## RPC Functions

### `generate_invite_code()` → text
- Security: `DEFINER`, granted to `authenticated`
- Returns unique `TC-XXXX` code (omits ambiguous chars 0/O/1/I/L)
- Loops until a non-colliding code is found

### `get_challenge_by_invite_code(code text)` → TABLE
- Security: `DEFINER`, granted to `anon, authenticated`
- Returns challenge details for pending/active group challenges
- Safe for unauthenticated users (invite preview screen)

---

## DB Triggers

### `on_participant_joined` (AFTER INSERT on `challenge_participants`)
Calls `activate_group_challenge()`:
- Checks if challenge is `type = 'group'` and `status = 'pending'`
- Counts current participants
- If count ≥ 3: sets `status = 'active'`, `start_date = now()`, `end_date = now() + duration`, `buyin_deadline = now() + 48h`, `join_deadline = now() + 48h`

---

## Plaid Integration

### What Exists
- `components/PlaidLink.tsx` — WebView wrapper around Plaid Link JS SDK
- `lib/plaid.ts` — client-side API wrapper calling edge functions
- 3 Supabase edge functions (Deno, written but not deployed):
  - `create-link-token` — generates Plaid Link token
  - `exchange-token` — exchanges public token for access token, upserts `plaid_items`
  - `sync-transactions` — fetches last 90 days of transactions into `bank_transactions`

### What's Missing
- Edge functions not deployed (`supabase functions deploy` not run)
- Plaid credentials not configured as Supabase secrets
- `bank_transactions` data not used for any task verification
- No automated disqualification detection from bank data

### To Enable (Sandbox)
```bash
# 1. Set secrets in Supabase Dashboard → Edge Functions → Secrets
PLAID_CLIENT_ID=<from dashboard.plaid.com>
PLAID_SECRET=<sandbox secret>
PLAID_ENV=sandbox

# 2. Deploy functions
supabase functions deploy create-link-token
supabase functions deploy exchange-token
supabase functions deploy sync-transactions

# 3. Test with Plaid sandbox credentials
# Bank: "Chase", User: user_good, Password: pass_good
```

---

## File Structure

```
app/
  _layout.tsx              # Root Stack + AuthProvider + join screen
  index.tsx                # Auth gate (redirects based on session)
  challenges.tsx           # Browse + solo/group/share modal flow
  challenge-details.tsx    # Task guidance + anti-gaming rules
  join/[code].tsx          # Invite deep-link handler (anon-safe)
  (auth)/
    _layout.tsx
    login.tsx
    signup.tsx
  (tabs)/
    _layout.tsx            # Bottom tabs (Home, Tasks, Wallet, Leaderboard)
    index.tsx              # Home: active challenge, pending state, buy-in state
    tasks.tsx              # Task list + completion
    wallet.tsx             # Buy-in, Plaid link, transactions, prize pool
    leaderboard.tsx        # Live rankings

components/
  PlaidLink.tsx            # Plaid Link WebView

contexts/
  AuthContext.tsx          # signIn, signUp, signOut, session, user

lib/
  supabase.ts              # Supabase client + SecureStore adapter
  plaid.ts                 # Plaid API (calls edge functions)

supabase/
  migrations/              # 10 migrations, all pushed
  functions/
    create-link-token/index.ts
    exchange-token/index.ts
    sync-transactions/index.ts
```

---

## Known Issues / Missing Features

### Critical (blocks user testing)
1. **Signup broken** — Disable email confirmation in Supabase Auth settings

### High Priority
2. **Plaid not deployed** — Wallet "Connect Bank" button fails silently
3. **No real payments** — Buy-in is simulated; no money moves
4. **No auto-cancel cron** — Expired pending challenges stay pending forever server-side
5. **No buy-in refund on dropout** — `prize_pool` is not decremented when a paid participant drops out; their buy-in forfeits to the remaining pool (behavior matches design intent but is not yet enforced server-side)

### Medium Priority
5. **No task auto-verification** — All tasks are self-reported; Plaid data not used
6. **No prize payout** — When challenge ends, winner is identified but no payout occurs
7. **App icon placeholder** — Default Expo template icon still in use
8. **App Store URLs placeholder** — Invite message links to fake store URLs

### Low Priority (future features)
9. No push notifications
10. No password reset email
11. No in-app chat or social features
12. No admin dashboard

---

## Build Commands

```bash
# Dev server (Windows)
node_modules/.bin/expo.cmd start --web --port 8081

# TypeScript check
npm run typecheck

# APK for testers (sideload)
eas build --platform android --profile preview

# Production AAB for Play Store
eas build --platform android --profile production

# Deploy Plaid edge functions
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy create-link-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy exchange-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy sync-transactions

# Push DB migrations
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe db push
```
