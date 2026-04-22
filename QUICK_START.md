# Tournacent Quick Start Guide

---

## Developer Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) — for APK builds
- Supabase CLI at `/tmp/supabase.exe` (Windows)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env` in the project root:
```
EXPO_PUBLIC_SUPABASE_URL=https://kqbxkeqyjrczvgksuyox.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Push database schema
```bash
SUPABASE_ACCESS_TOKEN=<your-token> /tmp/supabase.exe db push
```
Get your token from: Supabase Dashboard → Account → Access Tokens

### 4. Fix signup (required)
In [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Settings → Email:
- Uncheck **"Enable email confirmations"**
- Save

### 5. Start the dev server
```bash
node_modules/.bin/expo.cmd start --web --port 8081
```

---

## Plaid Setup (for bank verification tasks)

```bash
# 1. Set secrets in Supabase Dashboard → Edge Functions → Secrets
PLAID_CLIENT_ID=<from dashboard.plaid.com>
PLAID_SECRET=<sandbox secret>
PLAID_ENV=sandbox

# 2. Deploy functions
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy create-link-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy exchange-token
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy sync-transactions
SUPABASE_ACCESS_TOKEN=<token> /tmp/supabase.exe functions deploy plaid-webhook

# 3. Test with sandbox credentials
# Bank: "Chase", User: user_good, Password: pass_good
```

---

## Building an APK (Android Tester Build)

```bash
eas login
eas build --platform android --profile preview
```

Produces a `.apk` file testers can sideload directly.

---

## User Flow

### Sign Up
1. Open app → tap "Create Account"
2. Enter display name, email, password
3. App logs in immediately (requires email confirmation disabled — see above)

### Browse Challenges
1. Home screen shows "No Active Challenge" on first login
2. Tap **Browse Challenges**
3. Five preset challenges appear
4. Tap a challenge to open the selection modal

### Solo Challenge
1. Tap **Solo**
2. Challenge starts immediately
3. Home screen shows active challenge with countdown and tasks

### Group Challenge
1. Tap **Group** → confirm 3-player minimum
2. Invite code generated (e.g. `TC-A3KP`)
3. Tap **Share Invite** → OS share sheet opens
4. Home shows "Waiting for Players" with 48h countdown
5. When 3rd player joins → challenge auto-activates

### Complete Tasks
Go to **Tasks** tab. Each task opens a different completion flow based on its `verification_type`:

| Verification Type | What happens |
|-------------------|-------------|
| `self_report` | Confirm modal → complete |
| `plaid` | App checks your linked bank data automatically |
| `photo` | Image picker → upload screenshot as proof |
| `form` | In-app form (calculator, list builder, etc.) → compute results → submit |
| `quiz` | Answer all 10 questions → see your investment profile → submit |
| `counter` | Tap + each time you complete the action → upload photo at target → complete |
| `text` | Type your response (word count shown live) → submit |

Tasks also support swipe-right to trigger their completion flow.

### No-Spend Declaration (No-Spend Reset Challenge)
- Tapping the "Declare 3 Spending Categories" task opens a category picker
- Select exactly 3 Plaid spending categories to avoid
- Any purchase in those categories detected via bank feed will break your streak

### Drop Out
- Tap **Drop Out** on Home screen
- Inline confirmation (no popup)
- Soft-deleted: `dropped_out_at` timestamp set; cannot rejoin

---

## Five Preset Challenges

### 30-Day Emergency Fund Sprint
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $10.00 |
| Goal | Build $250+ emergency savings |
| Mandatory Tasks | 5 progressive Plaid-verified deposit milestones |
| Optional Tasks | 5 tasks (tracking, subscription, no-spend, education) |

### No-Spend Reset Challenge
| | |
|--|--|
| Duration | 21 days |
| Buy-In | $5.00 |
| Goal | Reduce spending, save $150+ |
| Mandatory Tasks | Declare categories + 7-day and 14-day streaks (Plaid-verified) |
| Optional Tasks | 4 tasks: counter (cooking), self-report, plaid (tracking + savings) |

### Debt Destroyer Sprint
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $25.00 |
| Goal | Pay $500+ toward debt; eliminate one debt |
| Mandatory Tasks | Connect debt account, form (APR calculator), 3 Plaid payment milestones |
| Optional Tasks | 6 tasks: spending freeze, photo uploads, form (debt avalanche), self-report |

### Investment Starter Challenge
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $20.00 |
| Goal | Open account, invest $300+, automate contributions |
| Mandatory Tasks | Quiz (risk assessment), photo, self-report, form (investment goal), 3 photo milestones |
| Optional Tasks | 7 tasks: self-report, form (ETF research + compound growth), text (community discussion) |

### Bill Negotiation Blitz
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $15.00 |
| Goal | Negotiate 2+ bills, document $100+ in annual savings |
| Mandatory Tasks | Form (bill audit), photo (market rates), text (negotiation script), photo (calls + wins), form (annual savings) |
| Optional Tasks | 5 tasks: photo (additional calls), self-report (streak) |

---

## Invite Code Format

Codes: `TC-XXXX` — characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(0, O, 1, I, L omitted to prevent confusion.)

---

## Known Issues

| Issue | Workaround |
|-------|-----------|
| Signup doesn't navigate after submit | Disable email confirmation in Supabase Auth settings |
| Bank-verified tasks fail | Set Plaid secrets and deploy edge functions |
| Buy-in doesn't charge real money | Intentional — simulated for testing |
| Pending challenges don't auto-cancel | Server-side cron not implemented |
| App Store/Play Store links in invites don't work | App not yet published |

---

## Tech Reference

| Command | Purpose |
|---------|---------|
| `node_modules/.bin/expo.cmd start` | Start dev server (Windows) |
| `npm run typecheck` | TypeScript check |
| `eas build --platform android --profile preview` | Build sideloadable APK |
| `SUPABASE_ACCESS_TOKEN=x /tmp/supabase.exe db push` | Push DB migrations |
| `SUPABASE_ACCESS_TOKEN=x /tmp/supabase.exe functions deploy <name>` | Deploy edge function |
