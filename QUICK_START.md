# Tournacent Quick Start Guide

## Getting Started

### Prerequisites
- Node.js 16+
- Expo CLI
- Supabase account

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create `.env` file:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Build Web**
   ```bash
   npm run build:web
   ```

---

## Two Challenges Available

### Challenge 1: 30-Day Emergency Fund Sprint
```
Duration:  30 days
Buy-In:    $10–$25
Goal:      Save $250–$500
Mandatory: 5 progressive deposit milestones
Optional:  8 additional savings/tracking tasks
Max Pts:   190
```

**Key Feature:** Deposits locked until challenge ends
**Color Code:** Violet = savings tasks

**Mandatory Tasks:**
1. Connect Savings Account (20 pts)
2. Set Emergency Fund Goal (10 pts)
3. Deposit $25+ (20 pts)
4. Deposit $100+ Total (40 pts) [Auto-unlock]
5. Deposit $250+ Total (60 pts) [Auto-unlock]

**Optional Tasks:**
- 7-Day Expense Tracking Streak (30 pts)
- Cancel One Subscription (25 pts)
- Automate Weekly Transfer (40 pts)
- Watch Savings Lesson (20 pts)
- 14-Day No-Impulse-Buy Streak (35 pts)

---

### Challenge 2: No-Spend Reset Challenge
```
Duration:  21 days
Buy-In:    $10–$20
Goal:      Reduce spending, save $150+
Mandatory: Declare categories + maintain streaks
Optional:  4 additional tracking/cooking tasks
Max Pts:   250
```

**Key Feature:** Single purchase breaks streak; counter resets to day 1
**Color Code:** Lime Green = avoid spending tasks

**Mandatory Tasks:**
1. Declare 3 Spending Categories (20 pts)
2. 7-Day No-Spend Streak (40 pts)
3. 14-Day No-Spend Streak (60 pts)

**Optional Tasks:**
- Cook at Home 10 Times (30 pts)
- Replace Purchase with Free Alternative (25 pts)
- Track Every Purchase 21 Days (40 pts)
- Save $150+ During Challenge (35 pts)

---

## User Journey

### 1. Sign Up
```
→ Enter email & password
→ Confirm email
→ Create profile (display name)
```

### 2. Browse Challenges
```
Home Screen: "No Active Challenges"
→ Tap "Browse Challenges"
→ See both preset challenges
→ Tap "Join Challenge"
```

### 3. Payment & Account Setup
```
Emergency Fund Sprint:
  → Enter buy-in amount
  → Connect bank via Plaid
  → Confirm payment

No-Spend Reset:
  → Enter buy-in amount
  → Declare 3 spending categories
  → Start tracking
```

### 4. Complete Tasks
```
Tasks Screen:
  → See all tasks for current challenge
  → Tap task for completion guidance
  → Complete task (manual or auto-verified)
  → See points update in real-time
```

### 5. Watch Leaderboard
```
Leaderboard Screen:
  → See your current rank
  → View all participant rankings
  → Track total points
  → View task completion progress
```

### 6. Win Prize
```
After challenge ends:
  → Highest points wins full pool
  → Payment processes automatically
  → Disqualified players shown in gray
  → Can start new challenge
```

---

## Screen Overview

### Home Screen
```
┌─────────────────────────────┐
│ Tournacent                  │
├─────────────────────────────┤
│ [Challenge Overview Card]   │ Green gradient
│ Prize: $80                  │ 30 Days Left
│ 4 Players | 150 Points      │
├─────────────────────────────┤
│ [Leaderboard Position]      │ Color-coded
│ You're in 2nd place         │ (gold/neutral/red)
├─────────────────────────────┤
│ [View Tasks] [Leaderboard]  │ Buttons
└─────────────────────────────┘
```

### Tasks Screen
```
┌─────────────────────────────┐
│ Tasks                       │
├─────────────────────────────┤
│ Points: 150 / 250           │ Sticky header
│ ████████░░░░ 12 of 18       │ Progress bar
├─────────────────────────────┤
│ [✓] Connect Account (Violet)│ Completed
│     20 pts | savings        │
├─────────────────────────────┤
│ [○] Set Emergency Goal      │ Incomplete
│     10 pts | savings        │ Tap to complete
├─────────────────────────────┤
│ [○] Deposit $25+            │
│     20 pts | savings        │
│     Tap for guidance        │
└─────────────────────────────┘
```

### Leaderboard Screen
```
┌─────────────────────────────┐
│ Leaderboard                 │
├─────────────────────────────┤
│ You're in 2nd place         │ Banner
├─────────────────────────────┤
│ 1. 👑 Sarah      250 pts    │ 1st (gold)
│    ████████████░░ 18/18     │
├─────────────────────────────┤
│ 2. ⭘ You        220 pts    │ Current (green)
│    ████████░░░░░░ 15/18     │
├─────────────────────────────┤
│ 3. ⭘ Mike       180 pts    │
│    ██████░░░░░░░░ 12/18     │
├─────────────────────────────┤
│ 4. ⚠ Alex       50 pts     │ Disqualified (gray)
│    ░░░░░░░░░░░░░░ 5/18      │
└─────────────────────────────┘
```

---

## Task Color Reference

| Color | Type | Examples |
|-------|------|----------|
| 🟣 Violet | Savings | Deposits, auto-transfers, savings goals |
| 🟢 Lime | No-Spend | Avoid categories, spending streaks |
| 🔵 Blue | Budget | Create budget, financial goals |
| 🟣 Purple | Tracking | Log expenses, spending logs |
| 🟠 Orange | Cooking | Cook at home, meal prep |
| 🔴 Red | Subscription | Cancel subscriptions |
| 🟢 Green | Reading | Educational content, lessons |
| ⚫ Gray | Other | Custom or miscellaneous |

---

## Anti-Gaming Rules

### Emergency Fund Sprint
- **Rule:** Deposits are locked until day 30
- **Violation:** Withdraw any amount
- **Consequence:** Automatic disqualification
- **Verification:** Real-time Plaid monitoring

### No-Spend Reset
- **Rule:** Zero spending in declared categories for X days
- **Violation:** Single purchase in target category
- **Consequence:** Streak resets to day 1
- **Verification:** Automatic bank transaction categorization

### Daily Tracking
- **Rule:** Must log entries on consecutive days
- **Violation:** Skip one day
- **Consequence:** Task becomes incomplete
- **Verification:** System timestamps all entries

---

## Key Features

✅ **Real-Time Leaderboard**
- Updates every 5 seconds
- Live point calculations
- Automatic rank recalculation

✅ **Color-Coded Tasks**
- Violet for savings (lock mechanism)
- Lime green for avoiding spending
- Other colors for different categories

✅ **Anti-Gaming**
- Bank-verified deposits
- Automatic streak resets
- Transaction monitoring
- One-time task completion (no undo)

✅ **Mobile-First**
- Fully responsive design
- Touch-optimized buttons
- Fast navigation
- Offline support

✅ **Secure**
- Row Level Security on all data
- Encrypted authentication
- No secrets in client code
- Audit trail of all actions

---

## Common Scenarios

### Joining Emergency Fund Sprint

1. Tap "Browse Challenges"
2. Tap "Join Challenge" on Emergency Fund Sprint
3. Enter $20 buy-in
4. Link bank account via Plaid
5. Confirm payment
6. Challenge appears on home screen
7. Bank shows account linked
8. Start depositing funds

### Breaking a No-Spend Streak

1. Declare categories: Dining, Coffee, Shopping
2. Day 1-7: Zero spending → 7-day streak complete ✓
3. Day 8: Buy $12 coffee
4. System detects spending in Coffee category
5. Streak breaks → 7-day task reverts to incomplete
6. Counter resets to day 1
7. You keep 0 points for this attempt
8. Can try again

### Getting Disqualified

1. Joined Emergency Fund Sprint
2. Deposited $250 ✓
3. Day 20: Need cash for emergency
4. Withdraw $100 from savings account
5. Plaid detects withdrawal
6. System marks you as disqualified
7. Appear grayed out on leaderboard
8. Removed from prize eligibility
9. Your $25 buy-in stays in prize pool

---

## Support Resources

**Documentation:**
- `CHALLENGE_MECHANICS.md` - Rules and verification
- `PRESET_CHALLENGES.md` - Challenge specs
- `DATABASE_SCHEMA.md` - Database design
- `IMPLEMENTATION_SUMMARY.md` - Full technical overview

**Development:**
- `npm run dev` - Start dev server
- `npm run build:web` - Build for web
- `npm run typecheck` - Check types
- `npm run lint` - Lint code

---

## Tips for Success

### Emergency Fund Sprint
1. Link your highest-yield savings account
2. Set up automatic weekly transfers
3. Make deposits earlier in the challenge
4. Don't withdraw (even if you need cash)
5. Track expenses to beat no-impulse streak

### No-Spend Reset
1. Choose categories you typically overspend in
2. Mark calendar for 7 and 14-day milestones
3. Log spending daily (don't miss a day)
4. Tell friends to hold you accountable
5. Replace purchases with free alternatives

### Win the Prize
1. Complete all mandatory tasks
2. Aim for optional tasks too
3. Watch the leaderboard daily
4. Stay accountable to yourself and others
5. Remember: it's about real behavior change

---

## Troubleshooting

**Can't log in?**
- Check email/password
- Reset password if forgotten
- Clear browser cache

**Payment stuck on "pending"?**
- Wait 5 minutes for verification
- Check bank confirms transaction
- Contact support if still pending

**Streak didn't break?**
- Verify spending was in your category
- Give system 24 hours to sync bank data
- Check transaction date matches purchase date

**Can't find my challenge?**
- Check you completed payment
- Look in Home screen (should show active challenge)
- Try refreshing app

**Points not updating?**
- Wait 10 seconds for real-time sync
- Refresh screen manually
- Check challenge is still active

---

## Need Help?

1. Review the challenge mechanics documentation
2. Check your task completion guidance
3. Verify payment was processed
4. Ensure bank account is linked properly
5. Contact support with challenge ID

---

**Happy saving! 💰**

