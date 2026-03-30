# Tournacent

A financial literacy challenge app where friends compete in groups by completing real financial tasks to win a pooled prize. Built with Expo Router (React Native) + Supabase.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo Router v6 |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Icons | lucide-react-native |
| Bank Integration | Plaid (sandbox-ready, not yet deployed) |
| Build | EAS (Expo Application Services) |

---

## App Identity

- **Name:** Tournacent
- **Bundle ID / Package:** `com.tournacent.app`
- **Deep Link Scheme:** `tournacent://`
- **Invite Link Format:** `https://tournacent.app/join/TC-XXXX`

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://kqbxkeqyjrczvgksuyox.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Push database migrations
```bash
/tmp/supabase.exe login
/tmp/supabase.exe db push
```

### 4. Disable email confirmation (required for signup to work)
In Supabase Dashboard → Authentication → Settings → Email → uncheck **"Enable email confirmations"**

### 5. Start dev server
```bash
node_modules/.bin/expo.cmd start --web --port 8081
```

### 6. Build APK for testing
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## Project Structure

```
app/
  _layout.tsx              # Root stack with AuthProvider
  index.tsx                # Splash / auth gate
  challenges.tsx           # Browse challenges + solo/group flow
  challenge-details.tsx    # Task guidance & anti-gaming rules
  join/[code].tsx          # Deep-link invite handler
  (auth)/
    login.tsx
    signup.tsx
  (tabs)/
    _layout.tsx            # Bottom tab navigation
    index.tsx              # Home (active challenge view)
    tasks.tsx              # Task list & completion
    wallet.tsx             # Buy-in, transactions, Plaid
    leaderboard.tsx        # Live rankings

components/
  PlaidLink.tsx            # WebView wrapper for Plaid Link JS SDK

contexts/
  AuthContext.tsx          # Auth state (signIn, signUp, signOut)

lib/
  supabase.ts              # Supabase client
  plaid.ts                 # Plaid API wrapper (calls edge functions)

supabase/
  functions/               # Deno edge functions (not yet deployed)
    create-link-token/
    exchange-token/
    sync-transactions/
  migrations/              # Applied in order
```

---

## What Works

- User signup / login (requires email confirmation disabled in Supabase)
- Browse 2 preset challenge templates
- Start a **solo** challenge (join immediately, solo competition)
- Start a **group** challenge (generates TC-XXXX invite code, native share sheet)
- Invite friends via SMS/Snapchat/Instagram/Email using native OS share
- Friends join via deep link (`tournacent://join/TC-XXXX`) or invite code
- Group challenge auto-activates when 3 players join (DB trigger)
- Additional players can join within 48h of activation
- Buy-in flow (simulated — marks DB field, no real money movement)
- Drop out of challenge with inline confirmation
- Task list with completion tracking and points
- Leaderboard with live rankings
- Transaction history in Wallet screen

## What's Not Working / Missing

See `FEATURES_CHECKLIST.md` for the full breakdown.

---

## Key Migrations

| File | Purpose |
|------|---------|
| `20260221155348_create_tournacent_schema_v2.sql` | Core schema |
| `20260223054751_create_preset_challenges.sql` | Original presets (superseded) |
| `20260318000000_add_plaid_tables.sql` | Plaid items + bank_transactions tables |
| `20260324000000_fix_preset_challenge_constraints.sql` | Constraint fixes |
| `20260324000001_fix_challenges_rls.sql` | RLS policy fixes |
| `20260328000000_allow_browse_active_challenges.sql` | Browse visibility fix |
| `20260328000001_fix_constraints_and_presets.sql` | Duration + task_type fixes, preset re-seed |
| `20260329000000_solo_group_challenges.sql` | Solo/group/invite/trigger/pending status |
| `20260329000001_fix_template_organizer.sql` | Allow NULL organizer on templates, re-seed |
