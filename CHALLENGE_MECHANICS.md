# Tournacent Challenge Mechanics

## Overview

Tournacent features two beginner-level preset challenges that users can join. Each challenge has specific completion requirements, anti-gaming rules, and verification methods to ensure real behavioral change and prevent fraud.

---

## Challenge 1: 30-Day Emergency Fund Sprint

**Level:** Beginner
**Duration:** 30 Days
**Buy-In:** $10–$25
**Target:** First-time savers
**Goal:** Save $250–$500

### Mandatory Tasks (Progressive Milestones)

Each milestone must be completed in order—no skipping tiers.

1. **Connect Savings Account** (20 pts)
   - Link your savings account via Plaid
   - Verification: One-time connection confirmation
   - Completion: Mark task complete after linking

2. **Set Emergency Fund Goal** (10 pts)
   - Define your target savings amount
   - Verification: Goal amount stored in system
   - Completion: Mark task complete after setting goal

3. **Deposit at Least $25** (20 pts)
   - Transfer $25 or more from an external account
   - Verification: Real-time bank feed via Plaid
   - Anti-Gaming Rule: Deposit must remain in account until challenge ends
   - Completion: Task auto-completes when deposit is verified

4. **Deposit at Least $100 Total** (40 pts)
   - Accumulate $100 in total deposits
   - Verification: Net positive balance checking (withdrawals reduce eligibility)
   - Anti-Gaming Rule: Cannot withdraw without disqualification
   - Completion: Task auto-completes at $100 threshold

5. **Deposit at Least $250 Total** (60 pts)
   - Accumulate $250 in total deposits
   - Verification: Continuous balance monitoring
   - Anti-Gaming Rule: Any withdrawal cancels milestone eligibility
   - Completion: Task auto-completes at $250 threshold

### Optional Tasks

1. **7-Day Expense Tracking Streak** (30 pts)
   - Log expenses daily for 7 consecutive days
   - Verification: Daily logging entries required
   - Anti-Gaming Rule: Missing one day resets streak
   - Completion: User marks complete after 7-day streak

2. **Cancel One Subscription** (25 pts)
   - Identify and cancel an unused subscription
   - Verification: User provides proof (screenshot, cancellation confirmation)
   - Completion: User uploads proof and marks complete

3. **Automate Weekly Transfer** (40 pts)
   - Set up automatic weekly savings transfers
   - Verification: Plaid detects recurring transfers
   - Completion: Task auto-completes when recurring transfer confirmed

4. **Watch Savings Fundamentals Lesson** (20 pts)
   - Complete an educational module on emergency funds
   - Verification: Module completion tracking
   - Completion: Task auto-completes after video/quiz

5. **14-Day No-Impulse-Buy Streak** (35 pts)
   - Avoid impulse purchases over $20 for 14 consecutive days
   - Verification: Bank transaction monitoring
   - Anti-Gaming Rule: Any single impulse purchase breaks streak
   - Completion: Task auto-completes at day 14 (if no qualifying purchases)

---

## Challenge 2: No-Spend Reset Challenge

**Level:** Beginner
**Duration:** 21 Days
**Buy-In:** $10–$20
**Goal:** Reduce discretionary spending
**Total Points:** 250

### Mandatory Tasks

1. **Declare 3 Spending Categories to Avoid** (20 pts)
   - Select 3 categories you will not spend in (e.g., dining out, coffee, shopping)
   - Verification: Categories stored in user profile
   - Completion: User marks complete after selecting categories

2. **7-Day No-Spend Streak** (40 pts)
   - Achieve 7 consecutive days with $0 spending in your declared categories
   - Verification: Daily transaction monitoring
   - Anti-Gaming Rule: Single purchase breaks streak; counter resets to day 1
   - Completion: Task auto-completes after 7 consecutive no-spend days

3. **14-Day No-Spend Streak** (60 pts)
   - Achieve 14 consecutive days with $0 spending in your declared categories
   - Verification: Continuous transaction monitoring
   - Anti-Gaming Rule: Any single purchase breaks streak
   - Completion: Task auto-completes after 14 consecutive no-spend days

### Optional Tasks

1. **Cook at Home 10 Times** (30 pts)
   - Prepare meals at home instead of ordering delivery/eating out
   - Verification: User logs each home-cooked meal
   - Completion: User logs 10 meals and marks complete

2. **Replace Purchase with Free Alternative** (25 pts)
   - Find a free substitute for a typical purchase
   - Verification: User provides description/proof
   - Completion: User describes alternative and marks complete

3. **Track Every Purchase for 21 Days** (40 pts)
   - Log all spending throughout the entire challenge
   - Verification: Daily spending logs required
   - Anti-Gaming Rule: Missing a single day invalidates task
   - Completion: Auto-completes after 21 consecutive logged days

4. **Save at Least $150 During Challenge** (35 pts)
   - Reduce overall spending enough to save $150+
   - Verification: Bank account balance comparison (start vs. end)
   - Completion: Task auto-completes when savings threshold met

---

## Anti-Gaming & Verification Logic

### Savings Deposits (Violet Tasks)

**Rule:** Deposits are locked until challenge ends.

- User cannot withdraw funds without automatic disqualification
- System monitors account via Plaid real-time feeds
- Withdrawal detected → user marked disqualified immediately
- Interest/dividends are allowed and do not break the rule
- Only net positive deposits count toward milestones

**Verification Method:**
- Plaid integration provides real-time account monitoring
- Daily reconciliation of account balance
- System compares current balance to initial balance at challenge start

### No-Spend Streaks (Lime Green Tasks)

**Rule:** Streaks reset on any purchase in target categories.

- User declares 3 spending categories to avoid
- Any transaction in these categories breaks the streak
- Counter resets to day 1 immediately
- Multiple failed attempts allowed; only longest streak counts
- Optional: User can manually log purchases for transparency

**Verification Method:**
- Automatic bank transaction monitoring via Plaid
- System categorizes transactions using merchant data
- Streak counter updates daily based on zero-spending verification

### Daily Tracking (All Challenges)

**Rule:** Missing a single day invalidates tracking tasks.

- For tasks requiring daily logging (expense tracking, spending logs)
- System enforces consecutive day requirements
- Missing logs result in task failure
- User must restart from day 1

**Verification Method:**
- User logs entries manually in app
- System timestamps each entry
- Gaps in dates trigger streak break

---

## Scoring & Disqualification

### Points Calculation

- User's total points = sum of all completed tasks
- Only completed tasks award points
- Broken streaks = zero points for that task attempt
- Mandatory tasks: failing one does NOT disqualify (unless explicitly required)

### Automatic Disqualification

User is disqualified if:

1. **Withdrawal from savings account** (Emergency Fund Sprint)
   - Automatic disqualification from deposit milestones
   - User removed from prize eligibility
   - Can remain on leaderboard as "Disqualified" for social accountability

2. **Failed all streaks** (No-Spend Reset)
   - Not automatic; user must complete at least one streak task
   - If all attempts fail, user cannot win prize

3. **Failed payment/payment fraud** (Both Challenges)
   - Non-payment of buy-in disqualifies user
   - Fraudulent payment attempt results in immediate removal

### Leaderboard Status

- **Active:** User is eligible for prize
- **Disqualified:** User removed from prize eligibility but visible on leaderboard (gray styling with "Disqualified" badge)
- **Dropped Out:** User voluntarily left the challenge; visible on leaderboard at the bottom (gray styling with "Dropped Out" badge); cannot rejoin via invite link
- **Not Ranked:** User hasn't completed any tasks yet

---

## Prize Distribution

- Prize pool = buy-in amount × number of active participants
- Winner = highest points at end of challenge
- Tie-breaker: First to reach point total wins
- Disqualified users' buy-in money remains in pool

**Example:**
- 4 participants, $20 buy-in each = $80 prize pool
- Winner with 250 points receives $80
- 1 disqualified player: $80 still distributed to winner (not split among remaining players)

---

## Implementation Notes

### Task Completion Flow

1. User opens task detail screen
2. System shows completion guidance & anti-gaming rules
3. User completes the requirement (manually or auto-verified)
4. System verifies completion:
   - Automatic tasks: Real-time via bank APIs
   - Manual tasks: User submits proof or confirmation
5. Task marked complete, points awarded, totals update
6. Leaderboard updates in real-time

### Real-Time Features

- Points update immediately upon task completion
- Leaderboard reflects changes within seconds
- Streak counters update daily at midnight
- Disqualification applies immediately upon trigger event

### Database Tracking

- `challenge_participants`: points, is_disqualified, disqualification_reason, dropped_out_at (soft-delete timestamp)
- `task_completions`: completed_at timestamp
- `transactions`: deposit/withdrawal tracking
- `spending_logs`: daily spending entries (for tracking tasks)

---

## Future Enhancements

1. **Custom Challenges:** Allow users to create challenges with custom tasks
2. **Teams:** Group-based challenges with team pooling
3. **Coaching:** In-app coaching modules linked to task completions
4. **Achievements:** Badges for completing all mandatory tasks
5. **Social Sharing:** Share progress and wins on social media
6. **Advanced Verification:** Receipt scanning, automated expense categorization

