# Tournacent Database Schema

Last updated: 2026-04-21

---

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

---

### 2. challenges
Main challenge records (instances and templates).

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
  challenge_type text DEFAULT 'solo',   -- 'solo' | 'group'
  is_template boolean DEFAULT false,
  invite_code text UNIQUE,
  pending_expires_at timestamptz,
  buyin_deadline timestamptz,
  join_deadline timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**Status lifecycle:** `template → pending → active → completed` (or `cancelled`)

---

### 3. challenge_participants

```sql
CREATE TABLE challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  points integer DEFAULT 0,
  is_disqualified boolean DEFAULT false,
  disqualification_reason text,
  payment_status text DEFAULT 'pending',  -- 'pending' | 'paid' | 'refunded'
  dropped_out_at timestamptz,             -- NULL = active; set = soft-deleted
  joined_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
```

---

### 4. tasks
Individual challenge tasks.

```sql
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  title text NOT NULL,
  description text NOT NULL,
  points integer NOT NULL,
  is_mandatory boolean DEFAULT false,
  task_type text NOT NULL,          -- drives color-coding only
  verification_type text NOT NULL DEFAULT 'self_report',  -- drives completion behavior
  form_id text,                     -- used by 'form' and 'quiz' verification types
  created_at timestamptz DEFAULT now()
);
```

**`task_type` values (color-coding):**

| Value | Color | Hex |
|-------|-------|-----|
| `savings` | Violet | `#A78BFA` |
| `no_spend` | Lime Green | `#84CC16` |
| `no_spend_declare` | Lime Green | `#84CC16` |
| `budget` | Blue | `#3B82F6` |
| `tracking` | Purple | `#8B5CF6` |
| `cooking` | Amber | `#F59E0B` |
| `subscription` | Red | `#EF4444` |
| `reading` | Green | `#10B981` |
| `debt_payment` | Orange | `#F97316` |
| `investment` | Teal | `#0D9488` |
| `negotiation` | Indigo | `#6366F1` |
| `custom` | Gray | `#6B7280` |

**`verification_type` values (completion behavior):**

| Value | Behavior |
|-------|----------|
| `plaid` | Auto-verified against `bank_transactions` / `plaid_accounts` |
| `photo` | User uploads image to `task-evidence` bucket |
| `self_report` | User taps confirm; no external check |
| `form` | Opens `FormModal`; data saved to `task_form_submissions` |
| `quiz` | Opens `QuizModal`; answers saved to `task_quiz_submissions` |
| `counter` | Opens `CounterModal`; count persisted to `task_counters` |
| `text` | Opens `TextEntryModal`; content saved to `task_text_submissions` |

**`form_id` values:**

| Value | Used by | Description |
|-------|---------|-------------|
| `apr_calculator` | form | Debt Destroyer — interest + payoff calculator |
| `debt_avalanche` | form | Debt Destroyer — prioritized payoff order |
| `investment_goal` | form | Investment Starter — target amount + timeline |
| `etf_research` | form | Investment Starter — 3 ETF entries with rationale |
| `bill_audit` | form | Bill Negotiation — recurring bill list |
| `annual_savings` | form | Bill Negotiation — confirmed savings calculator |
| `compound_growth` | form | Investment Starter — year-by-year projection |
| `risk_assessment` | quiz | Investment Starter — 10-question risk profile quiz |

---

### 5. task_completions
Audit trail of completed tasks.

```sql
CREATE TABLE task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  evidence_url text,      -- storage path for photo verification tasks
  completed_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);
```

---

### 6. transactions
Financial activity records.

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  amount numeric NOT NULL,
  transaction_type text NOT NULL,   -- 'buy_in' | 'payout' | 'refund'
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'verified' | 'in_progress' | 'denied'
  denial_reason text,
  created_at timestamptz DEFAULT now()
);
```

---

## Plaid Tables

### 7. plaid_items
Linked bank / credit accounts (access tokens stored server-side only).

```sql
CREATE TABLE plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL UNIQUE,
  institution_name text,
  institution_id text,
  item_type text NOT NULL DEFAULT 'savings',  -- 'savings' | 'debt'
  last_synced_at timestamptz,
  cursor text,                   -- Plaid incremental sync cursor
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, item_type)   -- one savings + one debt account per user
);
```

---

### 8. bank_transactions
Raw transactions synced from Plaid.

```sql
CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_transaction_id text NOT NULL UNIQUE,
  account_id text,
  item_type text NOT NULL DEFAULT 'savings',  -- 'savings' | 'debt'
  amount numeric NOT NULL,                    -- positive = debit/purchase; negative = payment/credit
  date date NOT NULL,
  name text,
  merchant_name text,
  personal_finance_category jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Sign convention (credit card / Plaid):**
- Positive amount → purchase / debit
- Negative amount → payment toward balance / credit

---

### 9. plaid_accounts
Per-account balance snapshot, refreshed after every debt webhook sync.

```sql
CREATE TABLE plaid_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id text NOT NULL,
  account_id text NOT NULL,
  name text,
  account_type text,
  account_subtype text,
  current_balance numeric,
  available_balance numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (account_id)
);
```

Used by `verifyDebtPaymentTask` to check whether "Pay Off One Debt Completely" is satisfied (`current_balance ≤ 5`).

---

## Task Submission Tables

### 10. task_form_submissions
Persists data entered in the 7 FormModal form types.

```sql
CREATE TABLE task_form_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  form_id text NOT NULL,
  form_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

**`form_data` shape by `form_id`:**

| `form_id` | Key fields stored |
|-----------|-------------------|
| `apr_calculator` | `balance`, `apr`, `min_payment`, `monthly_interest`, `months_to_payoff`, `total_interest` |
| `debt_avalanche` | `debts[]` — `{name, balance, apr}` sorted by APR descending |
| `investment_goal` | `target_amount`, `timeline_years` |
| `etf_research` | `etfs[]` — `{ticker, rationale, word_count}` |
| `bill_audit` | `bills[]` — `{provider, rate, contract_end}` |
| `annual_savings` | `reductions[]` — `{provider, old_rate, new_rate}`, `annual_total` |
| `compound_growth` | `principal`, `monthly_contribution`, `annual_return`, `years`, `final_value`, `projection[]` |

---

### 11. task_quiz_submissions
Persists quiz answers and computed profile.

```sql
CREATE TABLE task_quiz_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  quiz_id text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',   -- { question_id: choice_id }
  score integer NOT NULL,
  profile_label text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Risk Assessment scoring:**
- 10 questions × 4 choices (scored 1–4) = range 10–40
- Conservative: 10–15 | Moderately Conservative: 16–21 | Moderate: 22–27 | Moderately Aggressive: 28–33 | Aggressive Growth: 34–40

---

### 12. task_counters
Single-row-per-user-per-task progress counter.

```sql
CREATE TABLE task_counters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, task_id)
);
```

Counter target is parsed from the task title at runtime (e.g., "Cook at Home 10 Times" → 10). Each `+` / `−` tap immediately upserts this row. Photo evidence is required at submission time.

---

### 13. task_text_submissions
Persists free-text responses.

```sql
CREATE TABLE task_text_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  content text NOT NULL,
  word_count integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

Word minimum is parsed from the task description at runtime (e.g., "50+ words" → 50). No minimum is enforced if none is stated.

---

## No-Spend Tables

### 14. user_no_spend_categories
Stores the 3 Plaid categories each user declares to avoid.

```sql
CREATE TABLE user_no_spend_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  plaid_category text NOT NULL,          -- e.g. 'FOOD_AND_DRINK', 'SHOPPING'
  created_at timestamptz DEFAULT now()
);
```

---

## RLS Summary

All tables have RLS enabled. Policies follow the pattern `auth.uid() = user_id` for user-owned data.

| Table | Policies |
|-------|----------|
| `profiles` | Select own + others (leaderboard); update own |
| `challenges` | Select active/template/own; insert authenticated |
| `challenge_participants` | Select/insert/update own participation |
| `tasks` | Select for challenge participants |
| `task_completions` | Insert own; select within challenge |
| `transactions` | Select/insert own |
| `plaid_items` | Select/insert own |
| `bank_transactions` | Insert via service role (webhook); select own |
| `plaid_accounts` | Select own; insert/update via service role |
| `task_form_submissions` | Insert + select own |
| `task_quiz_submissions` | Insert + select own |
| `task_counters` | Full CRUD own |
| `task_text_submissions` | Insert + select own |
| `user_no_spend_categories` | Insert + select own |

---

## Migrations (in order)

| File | Description |
|------|-------------|
| `20260221155348` | Core schema v2 |
| `20260221155749` | Sample data |
| `20260223054751` | Preset challenges |
| `20260318000000` | Plaid tables (`plaid_items`, `bank_transactions`) |
| `20260324000000` | Fix preset challenge constraints |
| `20260324000001` | Fix challenges RLS |
| `20260328000000` | Allow browsing active challenges |
| `20260328000001` | Fix constraints and presets |
| `20260329000000` | Solo/group challenge support |
| `20260329000001` | Fix template organizer |
| `20260331000000` | Fix RLS recursion + task types |
| `20260331000001` | `task-evidence` storage bucket |
| `20260331000002` | Plaid sync cursor |
| `20260401000000` | `dropped_out_at` column |
| `20260401000001` | Group challenge fixes |
| `20260401000002` | `user_no_spend_categories` table |
| `20260401000003` | pg_cron streak automation |
| `20260401000004` | `drop_out` RPC |
| `20260421000000` | Dead function wiring cleanup |
| `20260421000001` | `verification_type` + `form_id` on `tasks` |
| `20260421000002` | Debt account schema (`item_type`, `plaid_accounts`) |
| `20260421000003` | `task_form_submissions` |
| `20260421000004` | `task_quiz_submissions` |
| `20260421000005` | `task_counters` |
| `20260421000006` | `task_text_submissions` |
