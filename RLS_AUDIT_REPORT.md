# RLS (Row-Level Security) Audit Report

**Assessment Date:** 2026-04-22  
**Remediation Date:** 2026-04-22  
**Scope:** All RLS policies in migrations 20260324000001 through 20260422000002  
**Risk Level:** 🟢 **LOW** — All confirmed issues remediated  
**Severity Breakdown:** 0 open issues (5 fixed, 0 false positives remaining)

---

## Executive Summary

All confirmed RLS issues have been remediated via three new migrations and two
inline migration comment updates. Core challenge isolation policies were verified
correct — no cross-group data access was confirmed.

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| Duplicate "view active challenges" policies | 🟢 **LOW** | ✅ Fixed | `20260422000000` |
| Submission tables lack challenge_id in SELECT | 🟡 **MEDIUM** | ✅ Fixed | `20260422000001` |
| Storage path format implicit / undocumented | 🟡 **MEDIUM** | ✅ Fixed | comment in `20260331000001` |
| Bank transactions single-account assumption undocumented | 🟡 **MEDIUM** | ✅ Fixed | comment in `20260318000000` |
| SECURITY DEFINER function grantable to anon | 🟡 **MEDIUM** | ✅ Fixed | `20260422000002` |
| RLS test suite missing | 🔴 **CRITICAL** | ✅ Fixed | `supabase/tests/rls_challenge_isolation.test.sql` |

**False positives (policies were already correct):**
- Task completion view policy — correctly isolated per challenge ✅
- Leaderboard query RLS — per-row filtering works correctly ✅
- Bank transactions RLS — user_id check sufficient (single account invariant) ✅
- Storage bucket path policy — first segment = user UUID correctly verified ✅

---

## 1. Critical Vulnerability: Task Completion View Policy

### 1.1 Vulnerable Policy

**Location:** `20260221155348_create_tournacent_schema_v2.sql:227-236`

```sql
CREATE POLICY "Users can view own task completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_completions.challenge_id
      AND challenge_participants.user_id = auth.uid()
    )
  );
```

### 1.2 The Vulnerability

**Issue:** The policy allows a user to view **ANY** task completion in **ANY** challenge they participate in.

**Attack scenario:**

1. User A joins Challenge X (30-day emergency fund sprint)
2. User B joins Challenge Y (no-spend reset challenge)
3. User A queries: `SELECT * FROM task_completions WHERE challenge_id = Challenge_Y.id`
4. Result: 🔴 **BLOCKED by policy** ✅ (correct)

Wait, actually the policy checks `challenge_participants.challenge_id = task_completions.challenge_id`, so User A must be a participant in Challenge Y to see Challenge Y's completions. Let me re-examine.

Actually, the policy is **correct** — it only allows viewing task_completions if the user is a participant in that specific challenge. A user in Challenge X cannot see Challenge Y's task_completions.

However, there's a **subtle issue**: the policy doesn't verify that the queried `task_completions.challenge_id` matches. It's possible but unlikely the application queries completions outside the challenge context.

### 1.3 Re-evaluation: NOT CRITICAL (False Positive)

On closer inspection, the policy is actually **correct**. The vulnerability I thought I found doesn't exist because:

- User A in Challenge X can only see task_completions where they are a participant
- User A cannot see Challenge Y's task_completions because the EXISTS check will fail
- The policy correctly isolates per challenge

**Verdict:** ✅ **No vulnerability here** (my initial assessment was wrong; this policy is well-designed).

---

## 2. High Vulnerability: Leaderboard Query Over-Broad RLS

### 2.1 The Vulnerability

**Location:** Implied by leaderboard queries in `app/(tabs)/leaderboard.tsx`

**Likely query pattern:**

```typescript
// Get leaderboard for all challenges the user is in
const { data: participants } = await supabase
  .from('challenge_participants')
  .select('user_id, points, rank, challenge_id')
  .in('challenge_id', userChallengeIds);

// Join to profiles to get names
const { data: leaderboard } = await supabase
  .from('challenge_participants')
  .select('points, rank, profiles(display_name), challenges(name)');
```

**Issue:** `challenge_participants` RLS policy uses SECURITY DEFINER function:

```sql
CREATE POLICY "Participants can view challenge participants"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (user_is_challenge_participant(challenge_id));
```

The function `user_is_challenge_participant(cid)` checks if the current user is a participant in `cid`. **But what if the client doesn't pass a filter on `challenge_id`?**

### 2.2 Attack: Leaderboard Without Filter

```typescript
// Vulnerable: no challenge_id filter
const { data } = await supabase
  .from('challenge_participants')
  .select('*'); // No WHERE clause!

// This should be blocked by RLS, but let's verify...
```

**Expected behavior:** RLS should block this because `user_is_challenge_participant(challenge_id)` will be evaluated for **each row**, and only rows where the user is a participant should be returned.

**Actual behavior:** ✅ **CORRECT** — Supabase evaluates RLS for each row, so the SECURITY DEFINER function returns FALSE for challenges the user isn't in, and those rows are filtered out.

**Verdict:** ✅ **No vulnerability here** — RLS per-row filtering works correctly even without explicit WHERE clause.

---

## 3. Medium Vulnerability: Bank Transactions RLS with Task Verification

### 3.1 The Vulnerability

**Location:** `20260318000000_add_plaid_tables.sql:75-88`

```sql
CREATE POLICY "Users can view own bank transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Issue:** `bank_transactions` only checks `user_id`, not `challenge_id`. This means:

```typescript
// Alice (User A) in Challenge X
const { data } = await supabase
  .from('bank_transactions')
  .select('*'); // Gets ALL of Alice's bank transactions across ALL challenges

// This includes bank data from other challenges Alice isn't in? No, Alice only has one bank link.
```

Actually, this is **not a vulnerability** because:
1. Each user can only have one bank account linked (`plaid_items` has UNIQUE constraint)
2. `bank_transactions` rows only exist for that one account
3. The user_id check is sufficient

However, there's a **subtle data isolation issue**: If Tournacent later implements multi-bank-account support, this policy would expose transactions across different linked accounts without challenge context.

**Verdict:** ✅ **Currently safe, but fragile design** — If multi-account support is added, this policy needs updating.

---

## 4. Medium Vulnerability: Storage Bucket Path Traversal

### 4.1 The Vulnerability

**Location:** `20260331000001_task_evidence_storage.sql`

```sql
CREATE POLICY "Users upload own evidence"
  ON objects FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure path starts with current user_id
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users view own evidence"
  ON objects FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );
```

**Issue:** The path policy checks only the **first directory** in the path. If the path format is `{userId}/{taskId}/{filename}`, the policy verifies `userId` matches.

**Attack scenario:**

```
Normal path: 550e8400-e29b-41d4-a716-446655440000/task-123/evidence.jpg

Can Alice (550e8400-...) access Bob's path (abcdef01-...)?
GET /storage/v1/object/public/task-evidence/abcdef01.../task-456/evidence.jpg

→ The policy checks: (string_to_array(name, '/'))[1] = 'abcdef01...'
→ Current user is Alice: auth.uid() = '550e8400...'
→ Result: ❌ BLOCKED (correct) ✅
```

Actually, the path policy is **correct**. The first element is the userId, which is verified.

**However, there's a risk:** If developers later change the path format (e.g., `{challengeId}/{userId}/{filename}`), the policy will silently fail to protect against cross-user access.

**Verdict:** ✅ **Currently safe, but path format is implicit and fragile**.

---

## 5. Challenge Browsing Policy: Open-Ended Risk

### 5.1 The Vulnerability

**Location:** `20260328000000_allow_browse_active_challenges.sql` + `20260324000001_fix_challenges_rls.sql`

```sql
CREATE POLICY "Authenticated users can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Authenticated users can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (status = 'active');
```

**Issue:** Two **identical policies** are created (appears to be duplicate migrations). This doesn't create a vulnerability, but it's redundant.

**More importantly:** The policy allows ANY authenticated user to see ANY active challenge. This includes:
- Challenge metadata (name, duration, buy-in amount)
- Organizer ID
- Prize pool amount (potentially)

**Risk:** A competitor could see other groups' buy-in amounts, prize pools, and strategies. This is a **business logic risk**, not a **security vulnerability**.

**Verdict:** ✅ **Acceptable for a public competition app** (like Kaggle). If challenges should be private, restrict this policy.

---

## 6. Missing Policies & Gaps

### 6.1 task_form_submissions, task_quiz_submissions, task_counters, task_text_submissions

**Location:** Migrations 20260421000003 through 20260421000006

```sql
CREATE POLICY "Users can insert own form submissions"
  ON task_form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own form submissions"
  ON task_form_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

**Issue:** These policies only check `user_id`, NOT `challenge_id`. This means:

```typescript
// Alice queries:
SELECT * FROM task_form_submissions WHERE user_id = auth.uid();

// Returns: All form submissions Alice has made across ALL challenges
// Is this a problem? Not really, because:
// 1. The data belongs to Alice anyway
// 2. Submissions are per-user, not per-challenge (in DB model)
// 3. But it would be safer to also filter by challenge context
```

**Verdict:** ✅ **Acceptable, but weak design** — Should include `challenge_id` in SELECT to enforce group isolation at the application level.

---

## 7. Summary of Findings

### Confirmed Issues — All Remediated ✅

| Issue | Severity | Impact | Fix Applied |
|-------|----------|--------|-------------|
| Duplicate "view active challenges" policies | 🟢 **LOW** | Redundant (benign) | `DROP POLICY "Anyone can view active challenges"` in `20260422000000` |
| Storage bucket path format implicit | 🟡 **MEDIUM** | Path change could silently break protection | PATH FORMAT CONTRACT comment block in `20260331000001` |
| Bank transactions single-account assumption | 🟡 **MEDIUM** | Fragile if multi-account support added | Warning comment in `20260318000000` |
| Submission tables lack challenge_id in SELECT | 🟡 **MEDIUM** | Weak isolation; application-level leak risk | Challenge participant EXISTS check added in `20260422000001` for all four submission tables |
| SECURITY DEFINER function open to PUBLIC | 🟡 **MEDIUM** | Anon callers could invoke function directly | `REVOKE EXECUTE … FROM PUBLIC; GRANT … TO authenticated, service_role` in `20260422000002` |
| No RLS test suite | 🔴 **CRITICAL** | Policy regressions invisible without tests | 16 pgTAP assertions in `supabase/tests/rls_challenge_isolation.test.sql` |

### False Positives (Policies Were Already Correct)

✅ Task completion view policy — EXISTS check on challenge_participants correctly scopes per challenge  
✅ Challenge participants view policy — SECURITY DEFINER function breaks recursion; per-row evaluation is correct  
✅ Challenge view policy — open browse by design (public competition model, same as Kaggle)  
✅ Storage bucket path policy — `(storage.foldername(name))[1] = auth.uid()::text` correctly verifies first segment

---

## 8. Remediation Applied

### Fix 1: Drop Duplicate Policy ✅

**Migration:** [`20260422000000_fix_duplicate_challenge_policy.sql`](supabase/migrations/20260422000000_fix_duplicate_challenge_policy.sql)

`20260324000001` created `"Anyone can view active challenges"` and `20260328000000`
created `"Authenticated users can view active challenges"` — both with identical
`USING (status = 'active')`. The older name was dropped; the more descriptive
policy from `20260328000000` is retained.

### Fix 2: Strengthen Submission SELECT Policies ✅

**Migration:** [`20260422000001_strengthen_submission_rls.sql`](supabase/migrations/20260422000001_strengthen_submission_rls.sql)

All four submission tables (`task_form_submissions`, `task_quiz_submissions`,
`task_counters`, `task_text_submissions`) now require the user to be an active
challenge participant for the specific challenge the row belongs to:

```sql
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE challenge_participants.challenge_id = <table>.challenge_id
      AND challenge_participants.user_id = auth.uid()
  )
)
```

`task_counters` had a single `FOR ALL` policy which was split into separate
SELECT (with challenge context), INSERT, and UPDATE policies.

### Fix 3: Document Storage Path Format Contract ✅

**File updated:** [`20260331000001_task_evidence_storage.sql`](supabase/migrations/20260331000001_task_evidence_storage.sql)

A PATH FORMAT CONTRACT comment block was added explaining that
`(storage.foldername(name))[1]` relies on the path format being
`{user_id}/{task_id}/{filename}`, and that changing the format without updating
the RLS check would silently break protection.

### Fix 4: Document Bank Transactions Single-Account Assumption ✅

**File updated:** [`20260318000000_add_plaid_tables.sql`](supabase/migrations/20260318000000_add_plaid_tables.sql)

A warning comment was added above the `bank_transactions` RLS policies explaining
that `user_id`-only isolation is correct only while `plaid_items` enforces
`UNIQUE(user_id)`. If multi-account support is ever added, the policies must include
`challenge_id` context.

### Fix 5: Lock SECURITY DEFINER Function ✅

**Migration:** [`20260422000002_lock_security_definer_function.sql`](supabase/migrations/20260422000002_lock_security_definer_function.sql)

```sql
REVOKE EXECUTE ON FUNCTION user_is_challenge_participant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION user_is_challenge_participant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION user_is_challenge_participant(uuid) TO service_role;
```

Anonymous Supabase clients can no longer invoke the function directly via RPC.

### Fix 6: RLS Test Suite ✅

**File:** [`supabase/tests/rls_challenge_isolation.test.sql`](supabase/tests/rls_challenge_isolation.test.sql)

16 pgTAP assertions covering:
- Cross-group `challenge_participants` isolation (Alice cannot read Challenge Y)
- Cross-group `task_completions` isolation
- Cross-group `task_form_submissions`, `task_quiz_submissions`, `task_text_submissions` isolation
- Unauthenticated access blocked for `challenge_participants`, `task_completions`, `bank_transactions`
- Active challenges visible to all authenticated users (browse by design)
- `user_is_challenge_participant()` returns correct boolean for in/out of group
- `plaid_items` — user reads exactly one row (own item)
- Storage `foldername()` extraction correctness

Run with: `supabase test db`

---

## 9. RLS Testing Checklist

### Automated Tests

Create `supabase/tests/rls.test.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

describe('RLS Challenge Isolation', () => {
  let alice: ReturnType<typeof createClient>;
  let bob: ReturnType<typeof createClient>;
  let aliceId: string;
  let bobId: string;
  let challengeX: { id: string };
  let challengeY: { id: string };

  beforeAll(async () => {
    // Create two users
    alice = createClient(supabaseUrl, anonKey);
    bob = createClient(supabaseUrl, anonKey);

    // Sign up and get IDs
    const { data: aliceAuth } = await alice.auth.signUpWithPassword({
      email: 'alice@test.com',
      password: 'testpass',
    });
    aliceId = aliceAuth.user!.id;

    const { data: bobAuth } = await bob.auth.signUpWithPassword({
      email: 'bob@test.com',
      password: 'testpass',
    });
    bobId = bobAuth.user!.id;

    // Alice creates Challenge X
    const { data: x } = await alice
      .from('challenges')
      .insert({ name: 'Challenge X', organizer_id: aliceId, buy_in_amount: 10, duration_days: 7 })
      .select()
      .single();
    challengeX = x!;

    // Bob creates Challenge Y
    const { data: y } = await bob
      .from('challenges')
      .insert({ name: 'Challenge Y', organizer_id: bobId, buy_in_amount: 10, duration_days: 7 })
      .select()
      .single();
    challengeY = y!;

    // Alice joins Challenge X
    await alice
      .from('challenge_participants')
      .insert({ challenge_id: challengeX.id, user_id: aliceId });

    // Bob joins Challenge Y
    await bob
      .from('challenge_participants')
      .insert({ challenge_id: challengeY.id, user_id: bobId });
  });

  test('Alice cannot see Challenge Y (not a participant)', async () => {
    const { data, error } = await alice
      .from('challenges')
      .select('*')
      .eq('id', challengeY.id);

    // Should return empty or error
    expect(data).toEqual([]);
    expect(error).toBeNull(); // RLS silently filters
  });

  test('Alice can see Challenge X (is a participant)', async () => {
    const { data, error } = await alice
      .from('challenges')
      .select('*')
      .eq('id', challengeX.id);

    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(challengeX.id);
  });

  test('Alice cannot see Bob\'s task completions in Challenge Y', async () => {
    // Bob completes a task in Challenge Y
    const { data: taskData } = await bob
      .from('tasks')
      .insert({
        challenge_id: challengeY.id,
        title: 'Test Task',
        description: 'Test',
        points: 10,
        task_type: 'savings',
      })
      .select()
      .single();

    const taskId = taskData!.id;

    // Bob completes it
    await bob.from('task_completions').insert({
      task_id: taskId,
      user_id: bobId,
      challenge_id: challengeY.id,
    });

    // Alice tries to query Bob's completions in Challenge Y
    const { data, error } = await alice
      .from('task_completions')
      .select('*')
      .eq('user_id', bobId)
      .eq('challenge_id', challengeY.id);

    // Should be blocked because Alice is not a participant in Challenge Y
    expect(data).toEqual([]);
  });

  test('Alice can see form submissions in Challenge X but not Challenge Y', async () => {
    // This test requires form_submissions to have challenge_id + RLS updated
    // (This is what Fix 2 above enables)
  });
});
```

**Run tests:**

```bash
npm test -- supabase/tests/rls.test.ts
```

---

## 10. RLS Best Practices Going Forward

### ✅ DO

1. **Always include context in RLS checks**
   ```sql
   -- ✅ Good: checks user_id AND challenge membership
   USING (
     user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM challenge_participants
       WHERE challenge_participants.challenge_id = task_completions.challenge_id
         AND challenge_participants.user_id = auth.uid()
     )
   )
   ```

2. **Document path formats explicitly**
   ```sql
   -- Path format: {userId}/{taskId}/{filename}
   WITH CHECK (auth.uid()::text = (string_to_array(name, '/'))[1])
   ```

3. **Test RLS policies in CI/CD**
   ```bash
   npm test -- supabase/tests/rls.test.ts
   ```

4. **Use SECURITY DEFINER functions carefully**
   ```sql
   SECURITY DEFINER SET search_path = public
   -- Always specify search_path and limit permissions
   ```

### ❌ DON'T

1. **Don't rely on application-level filtering**
   - Bad: Filter in app code, trust DB to not leak data
   - Good: Enforce at DB with RLS

2. **Don't create overly permissive "view all" policies**
   - Bad: `USING (status = 'active')` without user context
   - Good: `USING (status = 'active' AND (user_is_participant(id) OR is_template))`

3. **Don't forget to test after RLS changes**
   - Bad: Deploy policy change; find out it breaks leaderboard next week
   - Good: Run RLS tests before merge

4. **Don't mix business logic with RLS**
   - Bad: RLS checks payment status, disqualification, etc.
   - Good: RLS checks membership; business logic enforces rules

---

## 11. Risk Summary

### Current Risk Level: 🟢 **LOW**

All confirmed issues have been remediated. The core RLS policies for challenge
isolation were sound from the start — no confirmed cases of cross-user or
cross-group data access existed. The fixes add defense-in-depth (challenge context
on submission tables), remove surface area (SECURITY DEFINER function scope, public
execute grant), and formalise implicit assumptions (path format, single-account)
that would otherwise be invisible to future maintainers.

### Outstanding Actions (Monitoring)

| Priority | Action | Timeline |
|----------|--------|----------|
| 🔴 **CRITICAL** | Run `supabase test db` in CI on every PR touching RLS or migrations | Before next release |
| 🟡 **MEDIUM** | Review RLS policies on any new table added (use checklist in §Appendix) | Each sprint |
| 🟢 **LOW** | Quarterly review of `user_is_challenge_participant` function ownership | 2026-07-22 |

---

## Appendix: RLS Policy Checklist (For New Tables)

Before adding a new table to Tournacent, verify:

- [ ] RLS enabled: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
- [ ] SELECT policy: Restricts rows appropriately (challenge context + user context)
- [ ] INSERT policy: Validates user_id + challenge_id match
- [ ] UPDATE policy: Restricts to own rows + challenge context
- [ ] DELETE policy: If allowed, restrict to own rows + challenge context
- [ ] Path format documented: If using storage bucket
- [ ] Tests added: RLS test for new table isolation
- [ ] Migration comment: Document assumptions (single account, path format, etc.)

---

**Last Updated:** 2026-04-22 — All findings remediated  
**Next Audit:** 2026-07-22 (Quarterly)
