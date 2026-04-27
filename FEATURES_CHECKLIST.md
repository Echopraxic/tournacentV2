# Tournacent Features Checklist

Last updated: 2026-04-21

---

## Authentication

- [x] Email/password signup (UI complete)
- [x] Email/password login
- [x] Session persistence (expo-secure-store)
- [x] AuthContext global state
- [x] Protected routes (non-auth → redirected to login)
- [x] Password reset flow (forgot-password.tsx with deep-link email reset)

---

## Challenge Browsing

- [x] Browse screen shows preset challenge templates
- [x] Challenge cards show name, duration, buy-in, task count
- [x] RLS policy allows authenticated users to see templates (`is_template = true`)
- [x] 5 preset templates seeded: "30-Day Emergency Fund Sprint", "No-Spend Reset Challenge", "Debt Destroyer Sprint", "Investment Starter Challenge", "Bill Negotiation Blitz"
- [x] Presets seeded without requiring a real user as organizer (migration `20260329000001`)

---

## Solo Challenge Flow

- [x] User selects "Solo" from the challenge type modal
- [x] Creates a new challenge instance (copied from template)
- [x] Tasks copied from template to new challenge
- [x] User immediately added as participant with `payment_status = 'paid'`
- [x] Challenge appears on Home screen instantly

---

## Group Challenge Flow

- [x] User selects "Group" and sees 3-player minimum explanation
- [x] Generates human-readable invite code (`TC-XXXX` via DB RPC)
- [x] Creates group challenge with `status = 'pending'`
- [x] Tasks copied from template to new challenge
- [x] Native OS share sheet (SMS, Snapchat, Instagram, Email)
- [x] Home screen shows "Waiting for Players" state with player count
- [x] Invite code and share button visible on pending home screen
- [x] 48-hour pending expiry countdown shown
- [x] Group challenge auto-activates when 3rd player joins (DB trigger `on_participant_joined`)
- [x] Additional players can join within 48h after activation (`join_deadline`)
- [x] Auto-cancel expired pending challenges (pg_cron job in migration `20260401000003`; runs every 30 min)
- [x] Auto-cancel when buy-in deadline passes with < 3 paid players (pg_cron job `enforce_buyin_deadline` in migration `20260401000003`)

---

## Invite / Deep Link Flow

- [x] Invite URL format: `https://tournacent.app/join/TC-XXXX`
- [x] Deep link scheme: `tournacent://join/TC-XXXX`
- [x] `app/join/[code].tsx` handles deep link invite screen
- [x] `get_challenge_by_invite_code()` RPC is anon-safe (works before login)
- [x] Unauthenticated users see challenge preview + prompt to create account
- [x] Authenticated users can join directly from the invite screen
- [ ] **MISSING: Real App Store / Play Store links** — app not yet published, placeholder URLs used.

---

## Buy-In / Payment

- [x] Buy-in prompt shown when group challenge activates and `payment_status = 'pending'`
- [x] 48-hour countdown to buy-in deadline shown
- [x] "Confirm Buy-In" button on Home screen buy-in state
- [x] "Confirm Buy-In" button on Wallet screen (Debit Card option)
- [x] On confirmation: `payment_status` → `paid`, `prize_pool` incremented, transaction record created
- [ ] **SIMULATED ONLY: No real money moves** — buy-in marks a DB field. No Stripe, no ACH, no actual charge.
- [ ] **MISSING: Debit card input UI** — the "Debit Card" option has no card number entry.

---

## Drop Out

- [x] Drop Out button on Home screen (pending, buy-in, and active states)
- [x] Inline confirmation (no native Alert.alert)
- [x] Soft-delete: sets `dropped_out_at` timestamp on participant record
- [x] Home screen resets to "No Active Challenge" immediately after dropout
- [x] Tasks screen excludes dropped-out participations
- [x] Leaderboard excludes current user if they dropped out; shows "Dropped Out" badge for other dropped players
- [x] Join screen blocks re-joining after dropout
- [x] Buy-in refund on dropout (migration `20260422000006_drop_out_refund.sql`; inserts refund transaction and decrements prize pool)

---

## Task System

- [x] Tasks screen shows all tasks for active challenge
- [x] Mandatory task badge with warning icon
- [x] Color-coded task types (savings, no-spend, budget, tracking, cooking, debt_payment, investment, negotiation, subscription, reading, custom)
- [x] `task_type` drives color-coding only; `verification_type` drives completion behavior
- [x] Completion status tracked via `task_completions` table
- [x] Points awarded on task completion
- [x] Progress bar (completed / total tasks)
- [x] Swipe-right gesture to trigger task completion
- [x] `verification_type` field on all tasks; `form_id` for form and quiz tasks

### Verification Types — All Implemented

- [x] **`plaid`** — Plaid transaction/balance data verified via `lib/task-verification.ts`; routes `savings`, `no_spend`, `debt_payment` tasks to dedicated verifiers
- [x] **`photo`** — Image picker → upload to `task-evidence` storage bucket → stored path in `task_completions.evidence_url`; modal shows task description as upload prompt
- [x] **`self_report`** — User taps confirm; no external verification
- [x] **`form`** — Opens `FormModal` with 7 distinct form types:
  - `apr_calculator`: balance + APR + payment → monthly interest, months to payoff, total interest (computed before submit)
  - `debt_avalanche`: dynamic debt rows (add/remove) → sorted payoff order by APR
  - `investment_goal`: target amount + timeline (5+ year minimum enforced)
  - `etf_research`: 3 ETF entries with ticker + rationale (50-word minimum per entry enforced)
  - `bill_audit`: dynamic bill rows (add/remove, 5-row minimum enforced): provider, rate, contract end
  - `annual_savings`: dynamic rows → auto-computed annual savings total displayed live
  - `compound_growth`: real-time year-by-year projection table as user types
  - Submissions persisted to `task_form_submissions`
- [x] **`quiz`** — Opens `QuizModal`; quiz loaded from `lib/quizzes.ts` registry by `form_id`
  - Risk Assessment Quiz: 10 questions, 4 choices each (scored 1–4), 5 profile tiers
  - Profiles: Conservative, Moderately Conservative, Moderate, Moderately Aggressive, Aggressive Growth
  - Profile card shown once all 10 questions answered; submit button requires all answered
  - Submissions persisted to `task_quiz_submissions` (score + profile label stored)
- [x] **`counter`** — Opens `CounterModal`; target parsed from task title (e.g. "10 Times")
  - +/− buttons; each tap immediately upserts count to `task_counters`
  - Photo evidence required at target; "Complete" button enabled when count ≥ target AND photo selected
  - Live progress bar + count shown on task card in the list (`task_counters` loaded on every `fetchTasks`)
- [x] **`text`** — Opens `TextEntryModal` with large multiline input + live word count
  - Word minimum parsed from task description (e.g. "50+ words" → 50 minimum)
  - No minimum enforced if none stated in description
  - Submissions persisted to `task_text_submissions` (full content + word count stored)

### No-Spend Declaration

- [x] Separate category-picker modal for `no_spend_declare` tasks
- [x] User selects exactly 3 Plaid primary categories to avoid
- [x] Categories stored in `user_no_spend_categories`; used by webhook for streak violation detection

---

## Plaid / Bank Integration

- [x] Plaid Link UI (`components/PlaidLink.tsx`)
- [x] `lib/plaid.ts` API wrapper calls Supabase edge functions
- [x] Multi-account support: one savings account + one debt account per user (`item_type` field on `plaid_items`, unique constraint on `(user_id, item_type)`)
- [x] `getLinkedAccount()` — savings account only; `getLinkedDebtAccount()` — debt account only
- [x] `syncDebtTransactions()` — syncs debt account transactions with `item_type: 'debt'`
- [x] Wallet tab shows debt account section when user is in Debt Destroyer challenge
- [x] `plaid_accounts` table — stores per-account balances refreshed after every debt webhook sync
- [x] Edge functions deployed: `create-link-token`, `exchange-token`, `sync-transactions`, `plaid-webhook`
- [x] `exchange-token` accepts `item_type` and upserts on `(user_id, item_type)` constraint
- [x] `sync-transactions` accepts `item_type` param; stamps all transactions with their source item type
- [x] **Plaid webhook** (`plaid-webhook`): routes by `item_type`; savings items → no-spend violation check; debt items → spending freeze violation + `refreshAccountBalances()`
- [x] **Task verification connected**: `lib/task-verification.ts` reads `bank_transactions` to auto-verify Plaid tasks
  - Savings tasks: sum net deposits since challenge start vs. milestone thresholds
  - No-spend tasks: check for transactions in declared categories since last streak reset
  - Debt payment tasks: sum negative transactions on debt account; "Pay Off One Debt" reads `plaid_accounts.current_balance`
- [x] Debt violation detection: new credit card purchases >$50 break the 21-Day Spending Freeze streak
- [ ] **MISSING: Plaid credentials** — `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` must be set as Supabase function secrets.

---

## Leaderboard

- [x] Ranked participant list with points
- [x] Current user highlighted in green
- [x] 1st place crown icon
- [x] Disqualified players shown in gray with "Disqualified" badge
- [x] Dropped-out players shown in gray with "Dropped Out" badge, sorted below active and disqualified
- [x] Task completion progress bars per player
- [x] Refresh control
- [x] Challenge completion graphic (auto-displays when challenge ends naturally)
  - Score card with total points and progress bar
  - Tasks completed breakdown (mandatory vs optional)
  - Impact metrics and time elapsed (challenge-type-specific: debt paid, invested, annual savings, etc.)
  - Leaderboard rank (if multiplayer; skipped for solo)
  - Native share sheet (SMS, email, social media)
  - Copy to clipboard for share summary text

---

## Wallet

- [x] Transaction history (buy_in, payout, refund types)
- [x] Status badges (verified, in_progress, denied)
- [x] Prize pool display (total, paid count, pending count)
- [x] Buy-in banner when payment is pending on active challenge
- [x] Connect savings account via Plaid Link
- [x] Connect debt/credit card account via Plaid Link (shown for Debt Destroyer challenge)
- [x] Institution name shown after account linked
- [x] Sync Transactions button (savings and debt)

---

## Build & Deployment

- [x] `app.json` — correct name, slug, bundle ID (`com.tournacent.app`)
- [x] `eas.json` — preview (APK), development (APK), production (.aab) profiles
- [ ] **NOT DONE: EAS account setup** — must run `eas login` + `eas build` to produce APK
- [ ] **NOT DONE: App icon** — still using default Expo template icon
- [ ] **NOT DONE: Push notifications** — no notification system implemented
- [ ] **NOT DONE: App Store / Play Store submission**

---

## Server-Side Automation

- [x] pg_cron job: daily no-spend streak check (migration `20260401000003`)
- [x] pg_cron job: auto-cancel expired pending challenges (never reached 3 players within 48h)
- [x] pg_cron job: auto-cancel when buy-in deadline passes with < 3 paid players
- [x] pg_cron job: automated prize payout (winner-takes-all; ties split evenly; disqualified players excluded)
- [x] pg_cron jobs: automated data retention (session cleanup, balance snapshots, challenge anonymization, withdrawn consents) in migration `20260422000004`

---

## Summary

| Area | Status |
|------|--------|
| Auth UI | Done (signup requires email confirmation disabled) |
| Challenge browsing | Done |
| Solo challenges | Done |
| Group challenges + invite | Done |
| Buy-in (simulated) | Done |
| Real payment processing | Not started |
| Task completion — self_report | Done |
| Task completion — photo upload | Done |
| Task completion — plaid verified | Done |
| Task completion — form (7 types) | Done |
| Task completion — quiz | Done |
| Task completion — counter | Done |
| Task completion — text entry | Done |
| Plaid savings account | Done |
| Plaid debt account | Done |
| Plaid edge functions | Deployed |
| Task verification via Plaid | Done |
| Debt violation detection | Done |
| Leaderboard + completion graphic | Done |
| Server-side automation | Complete (streaks, pending cancel, buy-in cancel, payout, data retention) |
| APK build | Config ready, not built |
| App icon | Placeholder |
