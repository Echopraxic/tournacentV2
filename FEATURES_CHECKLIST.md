# Tournacent Features Checklist

Last updated: 2026-04-01

---

## Authentication

- [x] Email/password signup (UI complete)
- [x] Email/password login
- [x] Session persistence (expo-secure-store)
- [x] AuthContext global state
- [x] Protected routes (non-auth → redirected to login)
- [ ] **BROKEN: Signup silently fails** — Supabase requires email confirmation by default, but the app expects an immediate session. Fix: disable email confirmation in Supabase Dashboard → Auth → Settings → Email.

---

## Challenge Browsing

- [x] Browse screen shows preset challenge templates
- [x] Challenge cards show name, duration, buy-in, task count
- [x] RLS policy allows authenticated users to see templates (`is_template = true`)
- [x] 2 preset templates seeded: "30-Day Emergency Fund Sprint" + "No-Spend Reset Challenge"
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
- [ ] **MISSING: Server-side auto-cancel for expired pending challenges** — client checks `pending_expires_at` but no cron job or DB scheduler cancels challenges that never reach 3 players. Requires a Supabase scheduled function or pg_cron.
- [ ] **MISSING: Auto-cancel when buy-in deadline passes with < 3 paid players** — not implemented server-side.

---

## Invite / Deep Link Flow

- [x] Invite URL format: `https://tournacent.app/join/TC-XXXX`
- [x] Deep link scheme: `tournacent://join/TC-XXXX`
- [x] `app/join/[code].tsx` handles deep link invite screen
- [x] `get_challenge_by_invite_code()` RPC is anon-safe (works before login)
- [x] Unauthenticated users see challenge preview + prompt to create account
- [x] Authenticated users can join directly from the invite screen
- [x] App Store / Play Store URLs in invite message (currently placeholder `id000000000` / `com.tournacent`)
- [ ] **MISSING: Real App Store / Play Store links** — app not yet published, placeholder URLs used.

---

## Buy-In / Payment

- [x] Buy-in prompt shown when group challenge activates and `payment_status = 'pending'`
- [x] 48-hour countdown to buy-in deadline shown
- [x] "Confirm Buy-In" button on Home screen buy-in state
- [x] "Confirm Buy-In" button on Wallet screen (Debit Card option)
- [x] On confirmation: `payment_status` → `paid`, `prize_pool` incremented, transaction record created
- [ ] **SIMULATED ONLY: No real money moves** — buy-in marks a DB field. No Stripe, no ACH, no actual charge. This is intentional for user testing (Option A). Real payment processing requires Stripe or similar integration.
- [ ] **MISSING: Debit card input UI** — the "Debit Card" option has no card number entry. Real implementation requires Stripe Elements or similar.

---

## Drop Out

- [x] Drop Out button on Home screen (pending, buy-in, and active states)
- [x] Inline confirmation (no native Alert.alert)
- [x] Soft-delete: sets `dropped_out_at` timestamp on participant record (not a hard DELETE)
- [x] Home screen resets to "No Active Challenge" immediately after dropout
- [x] Tasks screen excludes dropped-out participations
- [x] Leaderboard excludes current user if they dropped out; shows "Dropped Out" badge for other dropped players
- [x] Join screen blocks re-joining after dropout ("You already dropped out of this challenge and cannot rejoin")
- [ ] **MISSING: Buy-in refund on drop out** — user's buy-in is not returned and the prize pool is not decremented. Forfeit behavior is not yet defined or enforced.

---

## Task System

- [x] Tasks screen shows all tasks for active challenge
- [x] Mandatory task badge with warning icon
- [x] Color-coded task types (savings, no-spend, tracking, cooking, etc.)
- [x] Completion status tracked via `task_completions` table
- [x] Points awarded on task completion
- [x] Progress bar (completed / total tasks)
- [x] `challenge-details.tsx` shows guidance and anti-gaming rules per task
- [ ] **NOT WIRED: Task auto-verification** — `lib/task-verification.ts` exists but is not connected to any automated verification. Tasks are self-reported (user taps "Complete"). Bank-based verification (checking Plaid transaction data) is not implemented.

---

## Plaid / Bank Integration

- [x] Plaid Link UI (WebView wrapper in `components/PlaidLink.tsx`)
- [x] `lib/plaid.ts` API wrapper calls 3 Supabase edge functions
- [x] 3 Deno edge functions written: `create-link-token`, `exchange-token`, `sync-transactions`
- [x] `plaid_items` and `bank_transactions` tables exist in schema
- [ ] **NOT DEPLOYED: Edge functions not pushed to Supabase** — `supabase functions deploy` has not been run. The Wallet "Connect Bank" button will fail with a network error.
- [ ] **MISSING: Plaid credentials** — `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` not set as Supabase function secrets. Must be configured in Supabase Dashboard → Edge Functions → Secrets.
- [ ] **NOT CONNECTED: Bank data not used for task verification** — even after Plaid is deployed, no logic reads `bank_transactions` to auto-complete tasks or detect disqualification.

**To enable Plaid (sandbox):**
1. Create account at dashboard.plaid.com
2. Get `client_id` + sandbox `secret`
3. Set secrets in Supabase dashboard
4. Run `supabase functions deploy create-link-token exchange-token sync-transactions`
5. Test with sandbox credentials (`user_good` / `pass_good`)

---

## Leaderboard

- [x] Ranked participant list with points
- [x] Current user highlighted in green
- [x] 1st place crown icon
- [x] Disqualified players shown in gray with "Disqualified" badge
- [x] Dropped-out players shown in gray with "Dropped Out" badge, sorted below active and disqualified players
- [x] Task completion progress bars per player
- [x] Refresh control

---

## Wallet

- [x] Transaction history (buy_in, payout, refund types)
- [x] Status badges (verified, in_progress, denied)
- [x] Prize pool display (total, paid count, pending count)
- [x] Buy-in banner when payment is pending on active challenge
- [x] "Connect Bank via Plaid" button (UI only — edge functions not deployed)
- [x] Institution name shown after bank is linked
- [x] Sync Transactions button (UI only — edge functions not deployed)

---

## Build & Deployment

- [x] `app.json` — correct name ("Tournacent"), slug, bundle ID (`com.tournacent.app`)
- [x] `eas.json` — preview (APK), development (APK), production (.aab) profiles
- [ ] **NOT DONE: EAS account setup** — must run `eas login` + `eas build` to produce APK
- [ ] **NOT DONE: App icon** — still using default Expo template icon
- [ ] **NOT DONE: Push notifications** — no notification system implemented
- [ ] **NOT DONE: App Store / Play Store submission** — requires real app icon, privacy policy, screenshots

---

## Server-Side Automation (Missing)

- [ ] **Auto-cancel expired pending challenges** — needs pg_cron or Supabase scheduled function
- [ ] **Auto-cancel when buy-in window closes with < 3 paid players** — same
- [ ] **Automated prize payout** — no logic to distribute prize pool when challenge ends
- [ ] **Streak monitoring** — no cron to check daily no-spend compliance
- [ ] **Disqualification detection** — no automated withdrawal detection from Plaid feed

---

## Summary

| Area | Status |
|------|--------|
| Auth UI | Done (signup broken by email confirmation) |
| Challenge browsing | Done |
| Solo challenges | Done |
| Group challenges + invite | Done |
| Deep link handling | Done |
| Buy-in (simulated) | Done |
| Real payment processing | Not started |
| Task completion (manual) | Done |
| Task verification (automated) | Not connected |
| Plaid UI | Done |
| Plaid edge functions | Written, not deployed |
| Leaderboard | Done |
| Server-side automation | Not implemented |
| APK build | Config ready, not built |
| App icon | Placeholder |
