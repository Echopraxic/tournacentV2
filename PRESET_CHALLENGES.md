# Tournacent: Two Preset Challenges

This document details the two challenges available for users to join immediately upon signing up.

---

## Challenge Selection Flow

1. User signs up / logs in
2. Home screen shows "No Active Challenges"
3. User taps "Browse Challenges"
4. Sees both preset challenges with key details
5. Taps "Join Challenge" to add themselves
6. Gets taken to onboarding (payment, account linking)
7. Joins the challenge and begins earning points

---

## Challenge 1: 30-Day Emergency Fund Sprint

### Overview

A 30-day savings challenge designed for first-time emergency fund builders. Focus: build the habit of saving and keep deposits locked until challenge ends.

**Duration:** 30 days
**Buy-In:** $10–$25 per person
**Target Savings:** $250–$500
**Goal Outcome:** Build emergency fund habit, lock in savings discipline

### Why This Challenge?

- Creates urgency (30 days)
- Progressive milestones keep players engaged
- Deposit locking prevents fraud and impulsive withdrawals
- Teaches "set it and forget it" savings mentality

### Mandatory Tasks (Unlock Progressively)

All mandatory tasks must be completed in order. No skipping tiers.

| Task | Points | How to Complete | Verification |
|------|--------|-----------------|--------------|
| Connect Savings Account | 20 | Link via Plaid/bank | One-time confirmation |
| Set Emergency Fund Goal | 10 | Define target amount | Stored in system |
| Deposit $25+ | 20 | Transfer funds | Bank feed verification |
| Deposit $100+ Total | 40 | Accumulate total | Real-time balance check |
| Deposit $250+ Total | 60 | Reach final tier | Continuous monitoring |

**Anti-Gaming Rules:**
- Withdrawals = automatic disqualification from deposit tasks
- Deposits must stay in account until challenge ends
- Only net positive increases count (no withdrawing then redepositing)

### Optional Tasks

| Task | Points | How to Complete |
|------|--------|-----------------|
| 7-Day Expense Tracking Streak | 30 | Log expenses daily × 7 days |
| Cancel One Subscription | 25 | Unsubscribe & submit proof |
| Automate Weekly Transfer | 40 | Set up recurring transfer |
| Watch Savings Fundamentals Lesson | 20 | Complete video + quiz |
| 14-Day No-Impulse-Buy Streak | 35 | Avoid $20+ purchases × 14 days |

**Max Optional Points:** 150
**Total Possible:** 190 points

### Color Coding

- **Violet (Savings):** Deposit-related tasks
  - Connect Account, Set Goal, Deposit milestones, Auto-transfer
  - Color: #A78BFA

- **Lime Green (Avoiding Spending):** No-impulse streak
  - Color: #84CC16

- **Orange (Other):** Tracking, subscriptions, education
  - Expense tracking, cancel subscription, lessons

### Success Criteria

**Win the prize if:**
- Complete all 5 mandatory deposit tasks
- Reach $250+ total deposits
- Maintain locked deposits through day 30
- Highest points at end of challenge

**Disqualified if:**
- Withdraw any amount from savings account
- Fail to deposit $25 by day 20 (soft deadline)

---

## Challenge 2: No-Spend Reset Challenge

### Overview

A 21-day spending reduction challenge. Players declare spending categories to avoid, maintain zero spending streaks, and track every purchase.

**Duration:** 21 days
**Buy-In:** $10–$20 per person
**Goal Outcome:** Break bad spending habits, save $150+, build awareness

### Why This Challenge?

- Shorter duration (21 days) = easier habit formation
- Customizable categories keep it personal
- Streak-based competition drives daily engagement
- Tracking creates awareness and accountability

### Mandatory Tasks

| Task | Points | How to Complete | Verification |
|------|--------|-----------------|--------------|
| Declare 3 Spending Categories | 20 | Choose categories to avoid | Stored & visible |
| 7-Day No-Spend Streak | 40 | Zero spending in target categories × 7 days | Bank transaction check |
| 14-Day No-Spend Streak | 60 | Maintain streak × 14 days | Continuous monitoring |

**Anti-Gaming Rules:**
- ANY single purchase in target categories breaks the streak
- Streak counter resets to day 1 immediately
- User can retry unlimited times (only longest counts)
- Breaking a streak doesn't remove previous points—just prevents continuation

**Example Categories Players Might Choose:**
- Dining out / coffee
- Shopping / impulse buys
- Subscriptions / streaming
- Delivery services
- Entertainment / movies

### Optional Tasks

| Task | Points | How to Complete |
|------|--------|-----------------|
| Cook at Home 10 Times | 30 | Log 10 home-cooked meals |
| Replace with Free Alternative | 25 | Describe free substitute |
| Track Every Purchase 21 Days | 40 | Daily spending logs (consecutive) |
| Save $150+ During Challenge | 35 | Reach savings goal |

**Max Optional Points:** 130
**Total Possible:** 250 points

### Color Coding

- **Lime Green (No-Spend):** Streak-based tasks
  - Declare categories, 7-day streak, 14-day streak
  - Color: #84CC16

- **Violet (Savings):** Save $150 task
  - Color: #A78BFA

- **Blue/Orange/Other:** Tracking, cooking, alternatives
  - Track purchases, cook at home, find free alternatives

### Streak Mechanics

**7-Day Streak Example:**

```
Day 1: ✓ Zero spending
Day 2: ✓ Zero spending
Day 3: ✓ Zero spending
Day 4: ✗ Spent $12 on coffee (BREAKS STREAK)
Day 5: Back to Day 1 (counter resets)
Day 6: ✓ Zero spending
...
Day 11: ✓ Zero spending (completed 7-day streak!)
```

**14-Day Streak Example:**

Must complete 14 consecutive days of zero spending in declared categories. Cannot complete until all 7-day streak is done + 7 more days.

### Success Criteria

**Win the prize if:**
- Complete both mandatory streaks (7 + 14 days)
- Track spending for all 21 days
- Highest points at end of challenge

**Disqualified if:**
- Fail to track spending for even 1 day
- Never complete a single 7-day streak (optional, but difficult)

---

## How Verification Works

### Real-Time Monitoring (Automatic)

For these tasks, the app monitors automatically:

1. **Savings Deposits**
   - Plaid integration feeds real-time account data
   - System detects deposits and updates progress
   - Deposits auto-lock until challenge end
   - Any withdrawal triggers instant disqualification

2. **No-Spend Streaks**
   - Bank transaction feed categorizes spending
   - System marks day as "broken" if transaction found in target category
   - Resets streak counter automatically
   - User notified immediately

3. **Spending Savings Goal ($150+)**
   - System compares starting balance to ending balance
   - Auto-completes when net savings reached

### Manual Logging (User-Initiated)

For these tasks, users manually log:

1. **Expense Tracking Streak**
   - User logs each day's expenses
   - System requires at least one entry per day
   - Missing one day breaks streak

2. **Cancel Subscription**
   - User uploads screenshot/confirmation
   - Admin briefly reviews for validity
   - Auto-approved in most cases

3. **Cook at Home**
   - User describes meal prepared
   - System tracks count
   - Can add photos for accountability

4. **Spending Log (21 Days)**
   - User logs every transaction
   - System timestamps and validates
   - Missing 1 day = task incomplete

### Verification Methods

| Verification Type | Task | API/Tool |
|-------------------|------|----------|
| Real-time bank feed | Deposits, no-spend streaks, savings goal | Plaid |
| Manual logging | Expense/spending tracking | In-app form |
| Photo/proof | Subscription cancellation, free alternatives | User upload |
| Automatic count | Cooked meals, | In-app logging |

---

## Prize Distribution

### Calculation

```
Prize Pool = Buy-In Amount × Number of Active (Non-Disqualified) Participants
Winner = Player with highest points at end of challenge
Disqualified Players = Removed from eligibility, but their buy-in stays in pool
Dropped-Out Players  = Voluntarily left; buy-in stays in pool, cannot rejoin
```

### Example Scenarios

**Scenario 1: 4 players, $20 buy-in each**
- Prize pool: $80
- All complete challenge
- Winner (250 pts) receives $80

**Scenario 2: 4 players, $20 buy-in each**
- Player 1 (250 pts) - Active
- Player 2 (180 pts) - Active
- Player 3 (150 pts) - Disqualified (withdrew savings)
- Player 4 (100 pts) - Active
- Prize pool: $80 (stays same, disqualified player's $20 doesn't return)
- Winner receives $80

**Scenario 3: 4 players, $20 buy-in each — one drops out**
- Player 1 (250 pts) - Active
- Player 2 (180 pts) - Active
- Player 3 (dropped out mid-challenge, had paid buy-in)
- Player 4 (100 pts) - Active
- Prize pool: $80 (dropped player's $20 stays in pool; cannot rejoin)
- Winner receives $80; Player 3 appears on leaderboard with "Dropped Out" badge

---

## User Journey: Joining a Challenge

### Step 1: Browse Challenges
User sees both challenges with:
- Name
- Duration
- Buy-in amount
- Current prize pool
- Participant count
- Join button

### Step 2: View Challenge Details
Before joining, user can:
- See all tasks with descriptions
- Read anti-gaming rules
- Understand verification methods
- See completion guidance

### Step 3: Confirm Payment
User:
- Selects payment method (bank/card/Venmo)
- Confirms buy-in amount
- Plaid links bank account (if savings challenge)

### Step 4: Challenge Onboarding
For **Emergency Fund Sprint:**
- Link savings account
- Set emergency fund goal
- Start making deposits

For **No-Spend Reset:**
- Declare 3 spending categories to avoid
- Start tracking spending

### Step 5: Begin Competing
- Home screen shows active challenge
- Tasks screen shows tasks to complete
- Leaderboard updates in real-time
- Wallet shows prize pool and payment status

---

## Anti-Gaming Safeguards

### Prevention Mechanisms

1. **Deposit Locking**
   - Real-time monitoring via Plaid
   - Automatic account flagging if withdrawal detected
   - Immediate disqualification

2. **Streak Resets**
   - Single transaction breaks streak
   - Cannot undo or manually reset
   - Counter resets automatically

3. **Daily Tracking Requirements**
   - Missing one day invalidates task
   - System enforces consecutive day requirement
   - No catch-up allowed

4. **Bank-Verified Transactions**
   - All deposits/spending verified against real bank feeds
   - Prevents fake screenshots or manual entry fraud
   - Real transactions only

5. **Progressive Milestones**
   - Cannot skip deposit tiers ($25 → $100 → $250)
   - Must complete in order
   - Prevents gaming progression system

---

## Key Features

### Color-Coded Task Types

- **Violet (#A78BFA):** Savings/deposit tasks
- **Lime Green (#84CC16):** No-spend/avoid spending tasks
- **Blue (#3B82F6):** Budget/goal-related tasks
- **Orange (#F59E0B):** Cooking/meal prep tasks
- **Red (#EF4444):** Subscription cancellation
- **Green (#10B981):** Education/reading tasks
- **Purple (#8B5CF6):** Tracking tasks

### Real-Time Updates

- Points update instantly
- Leaderboard refreshes every 5 seconds
- Streaks reset immediately
- Disqualification instant

### Mobile-First Design

- Fully responsive on all devices
- Touch-optimized buttons and forms
- Fast loading and navigation
- Offline support for some features

---

## Future Enhancement Ideas

1. **Referral System:** Invite friends for bonus points
2. **Badges:** Earn achievements (3-day streak, $500 saved, etc.)
3. **Coaching:** In-app tips based on task progress
4. **Social Sharing:** Share wins and progress on social
5. **Recurring Challenges:** Monthly/quarterly versions
6. **Custom Challenges:** User-created challenges with custom tasks
7. **Team Mode:** Groups can pool money together
8. **API Integration:** Connect to other fintech apps (Mint, YNAB)

