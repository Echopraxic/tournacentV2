# Tournacent Database Schema

## Core Tables

### 1. profiles
Stores user account information.

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
```

**Fields:**
- `id`: User UUID from Supabase Auth
- `display_name`: User's public name for leaderboards
- `avatar_url`: Profile picture URL
- `created_at`: Account creation timestamp

---

### 2. challenges
Main challenge records.

```sql
CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organizer_id uuid NOT NULL REFERENCES profiles(id),
  buy_in_amount numeric NOT NULL,
  duration_days integer NOT NULL,
  start_date timestamptz,
  end_date timestamptz,
  status text DEFAULT 'draft',
  prize_pool numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**Fields:**
- `id`: Unique challenge identifier
- `name`: Challenge title (e.g., "30-Day Emergency Fund Sprint")
- `organizer_id`: User ID of challenge creator
- `buy_in_amount`: Cost to join ($10–$50)
- `duration_days`: 7, 14, 21, or 30
- `start_date`: Challenge start (null until activated)
- `end_date`: Challenge end date
- `status`: 'draft', 'active', or 'completed'
- `prize_pool`: Total pooled money (buy_in_amount × active_participants)
- `created_at`: When challenge was created

**Preset Challenges:**
1. 30-Day Emergency Fund Sprint (organizer: system)
2. No-Spend Reset Challenge (organizer: system)

---

### 3. challenge_participants
Tracks user participation in challenges.

```sql
CREATE TABLE challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  points integer DEFAULT 0,
  is_disqualified boolean DEFAULT false,
  disqualification_reason text,
  payment_status text DEFAULT 'pending',
  rank integer,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
```

**Fields:**
- `id`: Participant record ID
- `challenge_id`: Which challenge
- `user_id`: Which user
- `points`: Total points earned (updated real-time)
- `is_disqualified`: true if removed from prize eligibility
- `disqualification_reason`: Why they were disqualified
- `payment_status`: 'pending', 'paid', or 'refunded'
- `rank`: Current leaderboard position (1, 2, 3, etc.)
- `joined_at`: When they joined

**Disqualification Reasons:**
- "Withdrew from savings account"
- "Failed mandatory task"
- "Payment failed"
- "Fraud detected"

---

### 4. tasks
Individual challenge tasks/milestones.

```sql
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  title text NOT NULL,
  description text NOT NULL,
  points integer NOT NULL,
  is_mandatory boolean DEFAULT false,
  task_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Fields:**
- `id`: Unique task identifier
- `challenge_id`: Which challenge this task belongs to
- `title`: Task name (e.g., "Deposit at Least $25")
- `description`: How to complete the task
- `points`: Points awarded when completed
- `is_mandatory`: true if failure = disqualification
- `task_type`: Category for color-coding

**Task Types:**
- `savings`: Violet - deposit/savings tasks
- `no_spend`: Lime green - avoid spending tasks
- `budget`: Blue - budgeting tasks
- `tracking`: Purple - tracking/logging tasks
- `cooking`: Orange - cooking/meal prep
- `subscription`: Red - subscription cancellation
- `reading`: Green - educational content
- `custom`: Gray - custom/other tasks

---

### 5. task_completions
Records when users complete tasks.

```sql
CREATE TABLE task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  completed_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);
```

**Fields:**
- `id`: Completion record ID
- `task_id`: Which task was completed
- `user_id`: Which user completed it
- `challenge_id`: Which challenge (denormalized for fast queries)
- `completed_at`: When they completed it

**Constraints:**
- Each user can only complete each task once per challenge
- Cannot be deleted (audit trail)

---

### 6. transactions
Financial activity tracking.

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  amount numeric NOT NULL,
  transaction_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  denial_reason text,
  created_at timestamptz DEFAULT now()
);
```

**Fields:**
- `id`: Transaction record ID
- `user_id`: Which user
- `challenge_id`: Which challenge
- `amount`: Dollar amount
- `transaction_type`: 'buy_in', 'payout', or 'refund'
- `status`: 'pending', 'verified', 'in_progress', or 'denied'
- `denial_reason`: Why transaction was denied
- `created_at`: When transaction occurred

**Transaction Flow:**

1. User joins challenge
   ```
   Type: buy_in
   Status: pending → in_progress → verified
   ```

2. Challenge ends, winner is determined
   ```
   Type: payout
   Status: pending → in_progress → verified
   ```

3. User withdraws early (emergency fund sprint)
   ```
   Type: refund
   Status: pending → verified (user disqualified)
   ```

---

## Queries

### Get User's Active Challenge

```sql
SELECT c.*, cp.points, cp.rank
FROM challenges c
JOIN challenge_participants cp ON cp.challenge_id = c.id
WHERE cp.user_id = auth.uid()
  AND c.status = 'active'
LIMIT 1;
```

### Get Leaderboard for Challenge

```sql
SELECT cp.rank, cp.points, cp.is_disqualified,
       p.display_name, p.avatar_url
FROM challenge_participants cp
JOIN profiles p ON p.id = cp.user_id
WHERE cp.challenge_id = $1
ORDER BY cp.rank ASC;
```

### Get Tasks for Challenge

```sql
SELECT *
FROM tasks
WHERE challenge_id = $1
ORDER BY points DESC, is_mandatory DESC;
```

### Get User's Completed Tasks in Challenge

```sql
SELECT t.*, tc.completed_at
FROM tasks t
LEFT JOIN task_completions tc
  ON tc.task_id = t.id
  AND tc.user_id = auth.uid()
WHERE t.challenge_id = $1
ORDER BY t.points DESC;
```

### Calculate Points

```sql
SELECT COUNT(*) as completed_tasks,
       SUM(t.points) as total_points
FROM task_completions tc
JOIN tasks t ON t.id = tc.task_id
WHERE tc.user_id = auth.uid()
  AND tc.challenge_id = $1;
```

### Get Prize Pool Info

```sql
SELECT c.prize_pool,
       COUNT(cp.id) as active_participants,
       SUM(CASE WHEN cp.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_participants
FROM challenges c
LEFT JOIN challenge_participants cp ON cp.challenge_id = c.id
  AND NOT cp.is_disqualified
WHERE c.id = $1
GROUP BY c.id;
```

---

## Indexes

For performance optimization:

```sql
CREATE INDEX idx_challenge_participants_challenge_id
  ON challenge_participants(challenge_id);

CREATE INDEX idx_challenge_participants_user_id
  ON challenge_participants(user_id);

CREATE INDEX idx_tasks_challenge_id
  ON tasks(challenge_id);

CREATE INDEX idx_task_completions_task_id
  ON task_completions(task_id);

CREATE INDEX idx_task_completions_user_id
  ON task_completions(user_id);

CREATE INDEX idx_transactions_user_id
  ON transactions(user_id);

CREATE INDEX idx_transactions_challenge_id
  ON transactions(challenge_id);
```

---

## Row Level Security (RLS) Policies

### profiles
- Users can view their own profile
- Users can view other users' profiles (for leaderboards)
- Users can update only their own profile

### challenges
- Users in a challenge can view it
- Organizers can update their challenges
- Authenticated users can create challenges

### challenge_participants
- Users can view other participants in their challenge
- Users can join challenges
- Users can update their own participation

### tasks
- Users in a challenge can view its tasks
- Challenge organizers can create tasks

### task_completions
- Users can view all completions in their challenges
- Users can complete their own tasks

### transactions
- Users can view only their own transactions

---

## Data Flow Examples

### Joining a Challenge

1. User clicks "Join Challenge"
2. System creates `challenge_participants` record:
   ```
   INSERT INTO challenge_participants (
     challenge_id, user_id, payment_status
   ) VALUES ($1, auth.uid(), 'pending');
   ```

3. User completes payment flow
4. System updates `transactions`:
   ```
   INSERT INTO transactions (
     user_id, challenge_id, amount, transaction_type, status
   ) VALUES (auth.uid(), $1, $2, 'buy_in', 'pending');
   ```

5. Payment verified
6. System updates participant:
   ```
   UPDATE challenge_participants
   SET payment_status = 'paid'
   WHERE user_id = auth.uid()
     AND challenge_id = $1;
   ```

### Completing a Task

1. User taps task
2. System verifies eligibility
3. User confirms completion
4. System creates `task_completions` record:
   ```
   INSERT INTO task_completions (
     task_id, user_id, challenge_id
   ) VALUES ($1, auth.uid(), $2);
   ```

5. System adds points:
   ```
   UPDATE challenge_participants
   SET points = points + $1
   WHERE user_id = auth.uid()
     AND challenge_id = $2;
   ```

6. System updates ranks:
   ```
   WITH ranked AS (
     SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC) as rank
     FROM challenge_participants
     WHERE challenge_id = $1
   )
   UPDATE challenge_participants cp
   SET rank = r.rank
   FROM ranked r
   WHERE cp.id = r.id;
   ```

### Disqualifying a User

1. System detects withdrawal/fraud
2. System updates participant:
   ```
   UPDATE challenge_participants
   SET is_disqualified = true,
       disqualification_reason = 'Withdrew from savings account'
   WHERE user_id = auth.uid()
     AND challenge_id = $1;
   ```

3. System recalculates leaderboard ranks
4. User appears as "Disqualified" on leaderboard (grayed out)
5. Prize pool redistributes among remaining active players

---

## Preset Challenge Data

### Challenge 1: 30-Day Emergency Fund Sprint

**Challenge Record:**
```
name: '30-Day Emergency Fund Sprint'
organizer_id: system_admin_id
buy_in_amount: 17.50
duration_days: 30
status: 'active'
```

**Tasks (13 total):**
- 5 mandatory savings tasks (20, 10, 20, 40, 60 pts)
- 8 optional tasks (30, 25, 40, 20, 35 pts - total 150)

### Challenge 2: No-Spend Reset Challenge

**Challenge Record:**
```
name: 'No-Spend Reset Challenge'
organizer_id: system_admin_id
buy_in_amount: 15
duration_days: 21
status: 'active'
```

**Tasks (7 total):**
- 3 mandatory no-spend tasks (20, 40, 60 pts)
- 4 optional tasks (30, 25, 40, 35 pts - total 130)

---

## Real-Time Updates

The app uses Supabase Realtime to keep data fresh:

```typescript
supabase
  .from('challenge_participants')
  .on('UPDATE', payload => {
    // Update leaderboard with new points/rank
  })
  .subscribe();

supabase
  .from('task_completions')
  .on('INSERT', payload => {
    // Update user's task list
  })
  .subscribe();
```

This enables:
- Live leaderboard updates
- Real-time point calculations
- Instant streak counters
- Immediate disqualification notifications

