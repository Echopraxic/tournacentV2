# Tournacent Quick Start Guide

---

## Developer Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) — for APK builds
- Supabase CLI at `/tmp/supabase.exe` (Windows) — see README for install

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

Without this, users who sign up can't log in (the app expects an immediate session).

### 5. Start the dev server
```bash
node_modules/.bin/expo.cmd start --web --port 8081
```

---

## Building an APK (Android Tester Build)

```bash
eas login          # login with your Expo account
eas build --platform android --profile preview
```

This produces a `.apk` file testers can sideload directly (no Play Store needed).

---

## User Flow

### Sign Up
1. Open app → tap "Create Account"
2. Enter display name, email, password
3. App logs you in immediately (requires email confirmation disabled — see above)

### Browse Challenges
1. Home screen shows "No Active Challenge" on first login
2. Tap **Browse Challenges**
3. Four preset challenges appear: "30-Day Emergency Fund Sprint", "No-Spend Reset Challenge", "Debt Destroyer Sprint", and "Investment Starter Challenge"
4. Tap a challenge to open the selection modal

### Solo Challenge
1. In the modal, tap **Solo**
2. Challenge starts immediately — no waiting
3. Home screen shows active challenge with countdown, prize pool, and tasks

### Group Challenge
1. In the modal, tap **Group**
2. Confirm you understand 3 players are needed
3. Invite code generated (e.g. `TC-A3KP`)
4. Tap **Share Invite** → OS share sheet opens
5. Send to friends via SMS, Snapchat, Instagram, Email
6. Home shows "Waiting for Players" (X/3) with 48h countdown
7. When 3rd person joins → challenge auto-activates

### Friend Joins via Invite
1. Friend receives link: `https://tournacent.app/join/TC-XXXX`
2. If app installed: opens `join/[code].tsx` screen directly
3. If not installed: App Store / Play Store link (placeholder until published)
4. Friend creates account (if needed) → joins challenge

### Buy-In (After Group Activates)
1. Home shows "Buy-In Required" banner
2. Wallet tab also shows buy-in prompt with deadline countdown
3. Tap **Confirm Buy-In** → payment marked as paid (simulated — no real charge)
4. Prize pool increments by buy-in amount
5. Transaction record added to history

### Complete Tasks
1. Go to **Tasks** tab
2. Tap any incomplete task
3. Tap **Complete Task**
4. Points added to your total
5. Leaderboard updates

### Drop Out
- On Home screen, tap **Drop Out** (available in pending, buy-in, and active states)
- Inline confirmation appears (no popup)
- Confirm → participation record stamped with `dropped_out_at` (soft-delete, not deleted)
- Home screen resets to "No Active Challenge"
- Dropped-out player appears on the leaderboard with a grey "Dropped Out" badge
- Re-joining the same challenge via the invite link is blocked

---

## Four Preset Challenges

### 30-Day Emergency Fund Sprint
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $10.00 |
| Goal | Build $250+ emergency savings |
| Mandatory Tasks | 5 progressive deposit milestones |
| Optional Tasks | 5 savings/tracking/no-spend tasks |

### No-Spend Reset Challenge
| | |
|--|--|
| Duration | 21 days |
| Buy-In | $5.00 |
| Goal | Reduce spending, save $150+ |
| Mandatory Tasks | Declare categories + 7 and 14-day streaks |
| Optional Tasks | 4 cooking/tracking/savings tasks |

### Debt Destroyer Sprint
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $25.00 |
| Goal | Pay $500+ toward debt; eliminate one debt |
| Mandatory Tasks | 5 debt payment milestones |
| Optional Tasks | 6 spending/income/credit tasks |

### Investment Starter Challenge
| | |
|--|--|
| Duration | 30 days |
| Buy-In | $20.00 |
| Goal | Open account, invest $300+, automate contributions |
| Mandatory Tasks | 7 account opening and investment milestones |
| Optional Tasks | 7 education, research, and growth tasks |

---

## Invite Code Format

Codes use the format `TC-XXXX` where each character is from: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(Ambiguous characters 0, O, 1, I, L omitted to prevent confusion.)

Example: `TC-A3KP`, `TC-ZMR7`

---

## Known Issues

| Issue | Workaround |
|-------|-----------|
| Signup doesn't navigate after submit | Disable email confirmation in Supabase Auth settings |
| "Connect Bank" button fails | Plaid edge functions not deployed yet |
| Buy-in doesn't charge real money | Intentional — simulated for testing |
| Pending challenges don't auto-cancel | Server-side cron not implemented; manual cleanup needed |
| App Store/Play Store links in invites don't work | App not yet published; placeholder URLs |

---

## Tech Reference

| Command | Purpose |
|---------|---------|
| `node_modules/.bin/expo.cmd start` | Start dev server (Windows) |
| `npm run typecheck` | TypeScript check |
| `eas build --platform android --profile preview` | Build sideloadable APK |
| `SUPABASE_ACCESS_TOKEN=x /tmp/supabase.exe db push` | Push DB migrations |
| `supabase functions deploy <name>` | Deploy edge function |
