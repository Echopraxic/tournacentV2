# Data Retention and Deletion Policy

**Effective Date:** [INSERT LAUNCH DATE]  
**Last Updated:** 2026-04-22  
**Jurisdiction:** Compliant with New York SHIELD Act, CCPA, and GDPR

---

## 1. Purpose

This policy defines:
1. **How long** we retain each type of user data
2. **Why** we retain it (legal, contractual, or legitimate business reasons)
3. **How** we securely delete data when retention period expires
4. **How users can request** data deletion at any time
5. **Our compliance obligations** under NY SHIELD Act, CCPA, and GDPR

---

## 2. Guiding Principles

- **Minimize collection:** Only collect data necessary for gameplay
- **Minimize retention:** Delete data as soon as its purpose is fulfilled
- **User control:** Users can delete their account and data at any time
- **Transparency:** Users can see what we hold and how long we keep it
- **Secure deletion:** Overwrite data cryptographically, not just "soft delete"

---

## 3. Data Retention Schedule

All retention periods are from the **date data is created** or **date of last access**, whichever is more recent (indicated by ⏰).

### 3.1 Account & Authentication Data

| Data Type | Table(s) | Retention Period | Reason | Post-Retention |
|-----------|----------|-----------------|--------|----------------|
| **Email address** | `auth.users` | Until account deletion | Authentication requirement | Immediate hard delete |
| **Password hash** | `auth.users` | Until account deletion | Authentication requirement | Immediate hard delete |
| **Display name** | `profiles` | Until account deletion (anonymized on leaderboard) | Identity for challenges | Anonymized or deleted |
| **Avatar image** | `profiles` | Until account deletion | Profile display | Deleted from storage |
| **JWT refresh tokens** | `auth.sessions` | 14 days ⏰ | Session validity | Auto-expire; delete on logout |
| **Login audit log** | Supabase Logs | 90 days ⏰ | Security investigation | Automatic purge |

---

### 3.2 Challenge & Task Data

| Data Type | Table(s) | Retention Period | Reason | Post-Retention |
|-----------|----------|-----------------|--------|----------------|
| **Challenge metadata** | `challenges` | Duration + 30 days after completion | Leaderboard, prize distribution | Anonymize (remove user IDs) |
| **Participant records** | `challenge_participants` | Duration + 30 days after completion | Points, payment tracking | Anonymize |
| **Task definitions** | `tasks` | Forever | Reference for analytics, dispute resolution | No deletion; non-PII |
| **Task completions** | `task_completions` | Duration + 30 days after completion | Verify game completion | Anonymize or delete |
| **Points history** | `challenge_participants.points` | Duration + 1 year | Audit trail, dispute resolution | Archive (offline storage) |

---

### 3.3 User-Submitted Content

| Data Type | Table(s) | Retention Period | Reason | Post-Retention |
|-----------|----------|-----------------|--------|----------------|
| **Photo evidence** | Storage (`task-evidence/`) | Duration + 30 days after completion | Task verification | Secure delete (3-pass overwrite) |
| **Form submissions** | `task_form_submissions` | Duration + 1 year | Audit trail | Delete from DB + delete from backups |
| **Quiz answers** | `task_quiz_submissions` | Duration + 1 year | Audit trail | Delete from DB + delete from backups |
| **Counter progress** | `task_counters` | Duration + 30 days | Task verification | Delete |
| **Text submissions** | `task_text_submissions` | Duration + 1 year | Audit trail | Delete |

---

### 3.4 Financial & Plaid Data

**IMPORTANT:** Different retention rules apply to financial data for legal compliance.

| Data Type | Table(s) | Retention Period | Reason | Post-Retention |
|-----------|----------|-----------------|--------|----------------|
| **Plaid access token** | `plaid_items.access_token` | Until Plaid unlink or account deletion | API authentication | Revoked in Plaid immediately; deleted from DB |
| **Bank transactions** | `bank_transactions` | 7 years from date of transaction | IRS tax compliance, fraud investigation | Transfer to cold storage (offline), then delete |
| **Account balances** | `plaid_accounts` | 90 days ⏰ | Task verification, fraud detection | Delete automatically |
| **Transaction sync metadata** | `plaid_items.cursor` | Until account deletion | Incremental sync state | Delete on account deletion |
| **Buy-in transactions** | `transactions` | 7 years from date | Accounting, tax, chargebacks | Transfer to cold storage, then delete |
| **Refund records** | `transactions` | 7 years from date | Tax compliance | Transfer to cold storage, then delete |
| **No-spend categories** | `user_no_spend_categories` | Duration + 30 days | Challenge data | Delete |

---

### 3.5 Plaid-Specific Compliance

Tournacent is a Plaid API user. Per **Plaid's Acceptable Use Policy**:

| Requirement | Our Implementation |
|-------------|-------------------|
| Store access tokens securely | Column-level encryption (pgcrypto); server-side only |
| Encrypt data in transit | TLS 1.2+; Plaid's SDK enforces this |
| Delete tokens on unlink | Immediate revocation in Plaid; delete from DB within 24 hours |
| Do not cache transaction data indefinitely | Sync only last 2 years; auto-delete after 7-year tax hold |
| Provide user control | Users can disconnect bank account in-app anytime |

---

### 3.6 Support & Dispute Data

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| **Support emails / tickets** | 3 years after resolution | Legal liability, chargeback defense |
| **Fraud investigation records** | 3 years after closure | Pattern detection, repeat offender identification |
| **Incident reports** | 3 years | Regulatory review, liability defense |

---

### 3.7 Legal & Regulatory Data

| Data Type | Retention | Reason | Waiver |
|-----------|-----------|--------|--------|
| **Subpoena / court order compliance** | Per court order | Legal obligation | Required by law; cannot delete |
| **Tax records** | 7 years | IRS statute of limitations | Cannot delete; secure storage required |
| **Data breach records** | 3 years minimum | NY SHIELD Act §668-f | Required by law |

---

## 4. Retention by User Lifecycle

### 4.1 Active User (In Challenge)

Data is retained **for the duration of the challenge** plus **30 days post-completion** for:
- Task completion verification
- Dispute resolution
- Prize payout

**Example:** User completes 30-day challenge on May 31, 2026. We keep their data until July 1, 2026.

### 4.2 Inactive User (No Active Challenges)

Data is retained per the retention schedule above, **regardless of inactivity**. However:
- If account is inactive for 2 years and user hasn't logged in, we may send a notification offering to delete their data
- Financial data (7-year retention) is kept regardless of login status

### 4.3 Deleted Account

When a user requests account deletion (Settings → Delete Account):

| Action | Timeline | Confirmation |
|--------|----------|--------------|
| Revoke Plaid access token | Immediate | User receives email with Plaid disconnection link |
| Delete from auth.users | 30 days (backup recovery) | Account login denied immediately |
| Hard-delete PII (email, name) | Immediate | Confirmation email sent |
| Soft-delete challenge data | Immediate | Anonymized on leaderboard |
| Delete personal data (photos, forms) | Immediate | Secure 3-pass overwrite |
| Delete transaction records | 7 years (tax hold) | User notified that tax data retained |

User receives confirmation email with details of what was deleted vs. retained.

---

## 5. User-Initiated Deletion Rights

### 5.1 Delete My Account

**Who can do it:** Any authenticated user  
**How:** Settings → Account → Delete Account → Type "DELETE" to confirm  
**Processing time:** Immediate (30-day grace period for data recovery)

**Scope:**
- ✅ Delete email, name, avatar
- ✅ Delete task submissions
- ✅ Delete Plaid link (revoked immediately)
- ✅ Anonymize leaderboard entry
- ❌ Retain financial data (7-year tax hold)
- ❌ Retain fraud investigation data (if active)

### 5.2 Delete Specific Data

**Who can do it:** Any authenticated user  
**How:** In-app options:
- **Photos:** Photo gallery → long-press → Delete
- **Form responses:** Challenge → Task → Delete submission
- **Quiz answers:** Challenge → Task → Delete submission
- **Text entries:** Challenge → Task → Delete submission

**Processing time:** Immediate

### 5.3 Download My Data (Data Portability)

**Who can do it:** Any authenticated user  
**How:** Settings → Privacy → Download My Data  
**Format:** JSON export containing:
- Profile info
- Challenge history
- Task submissions
- Aggregate statistics

**Processing time:** Generated instantly; emailed within 24 hours

### 5.4 Data Access Request (CCPA / GDPR)

**Who can do it:** Any user (authenticated or not)  
**How:** Email privacy@tournacent.com with subject "Data Access Request"  
**Scope:** All personal information we hold  
**Processing time:** 30 calendar days

**We provide:**
- Verification of your identity
- Complete data dump in machine-readable format (CSV/JSON)
- Explanation of data categories

---

## 6. Operational Data Deletion Procedures

### 6.1 Automated Deletion (Cron Jobs)

Supabase pg_cron jobs execute automatically:

```sql
-- Daily: delete expired JWT sessions
SELECT cron.schedule('delete-expired-sessions', '0 2 * * *', 
  'DELETE FROM auth.sessions WHERE expires_at < now()');

-- Daily: delete 90-day-old account balance snapshots
SELECT cron.schedule('delete-old-balances', '0 3 * * *', 
  'DELETE FROM plaid_accounts WHERE updated_at < now() - interval ''90 days''');

-- Weekly: anonymize completed challenges (30+ days post-completion)
SELECT cron.schedule('anonymize-old-challenges', '0 4 * * 0', 
  'UPDATE challenge_participants SET user_id = NULL 
   WHERE challenge_id IN (SELECT id FROM challenges 
   WHERE end_date < now() - interval ''30 days'')');

-- Monthly: delete 90-day-old crash reports
SELECT cron.schedule('delete-old-crash-reports', '0 1 1 * *', 
  'DELETE FROM supabase_logs WHERE log_type = ''crash'' 
   AND created_at < now() - interval ''90 days''');
```

### 6.2 Manual Deletion (User Request)

**Workflow:**

1. User requests deletion in Settings or via email
2. System sends confirmation email with 7-day grace period
3. User confirms within 7 days (or timeout = auto-delete)
4. Deletion is executed:
   - Hard delete from main DB tables
   - Hard delete from Supabase Storage
   - Remove from latest backup (if possible)
5. Confirmation email sent with list of deleted items

**Implementation:**

```sql
-- User-initiated deletion RPC
CREATE OR REPLACE FUNCTION delete_user_data(user_id_to_delete uuid)
RETURNS TABLE(deleted_count int, retained_tables text[]) AS $$
DECLARE
  deleted int := 0;
  retained text[] := '{}';
BEGIN
  -- Delete PII
  DELETE FROM profiles WHERE id = user_id_to_delete;
  deleted := deleted + 1;
  
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  deleted := deleted + 1;
  
  -- Delete task submissions
  DELETE FROM task_completions WHERE user_id = user_id_to_delete;
  DELETE FROM task_form_submissions WHERE user_id = user_id_to_delete;
  DELETE FROM task_quiz_submissions WHERE user_id = user_id_to_delete;
  DELETE FROM task_counters WHERE user_id = user_id_to_delete;
  DELETE FROM task_text_submissions WHERE user_id = user_id_to_delete;
  deleted := deleted + 5;
  
  -- Anonymize challenge participation
  UPDATE challenge_participants SET user_id = NULL 
    WHERE user_id = user_id_to_delete;
  
  -- Revoke Plaid access
  UPDATE plaid_items SET access_token = NULL 
    WHERE user_id = user_id_to_delete;
  
  -- Mark as retained (not deleted)
  retained := ARRAY['bank_transactions', 'transactions', 'plaid_items (token only)'];
  
  RETURN QUERY SELECT deleted, retained;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.3 Data Storage Deletion (Secure Wipe)

When deleting files from Supabase Storage, we use:

```typescript
// 1. Delete from Storage (soft delete)
await supabase.storage.from('task-evidence')
  .remove([`${userId}/${taskId}`]);

// 2. Supabase automatically handles secure deletion
// (configured in backend: overwrite with cryptographic zeros)
```

**Supabase backend configuration:**
- Enable "Soft delete" (retention 30 days for recovery)
- After 30 days, permanent hard delete with 3-pass overwrite (DOD 5220.22-M)

---

## 7. Backup & Archive Retention

**Supabase auto-backups:** Retained for **30 days** by default. We do not manually retrieve deleted data from backups for users unless compelled by law (subpoena).

**7-year archive (financial data):** Financial records are transferred to cold storage (offline, encrypted):
- Location: [INSERT SECURE STORAGE LOCATION]
- Access: Audit trail required; restricted to finance team
- Deletion: Securely destroyed after 7-year hold expires

---

## 8. SHIELD Act (New York) Compliance

| Requirement | Implementation |
|-------------|-----------------|
| **Reasonable security measures** | SECURITY_POLICY.md §5 + annual third-party audit (pending) |
| **Data minimization** | Only collect what's necessary for gameplay |
| **Breach notification (30 days)** | Automated email + SMS to affected users; NY AG notified if 500+ residents |
| **Secure deletion** | 3-pass overwrite (DOD 5220.22-M) or crypto-erasure |
| **User rights** | Access, deletion, correction, portability (§5 above) |
| **Service provider agreements** | In place with Supabase, Plaid, EAS |
| **Data retention limits** | Defined schedules above; no indefinite retention except tax records |

---

## 9. CCPA / CPRA (California) Compliance

| Requirement | Implementation |
|-------------|-----------------|
| **Disclose data collection** | PRIVACY_POLICY.md §2 |
| **Honor deletion requests** | Automated workflow (§6.2) within 30 days |
| **Provide access** | Settings → Download My Data or email request |
| **Do not discriminate** | No price/service differences for exercising rights |
| **Sale opt-out** | We don't sell data; clause included in PRIVACY_POLICY.md |
| **Sensitive data limits** | Financial data processed only for gameplay |

---

## 10. GDPR (EU) Compliance

| Requirement | Implementation |
|-------------|-----------------|
| **Lawful basis** | Consent (for Plaid), Contract (for gameplay), Legal obligation (taxes) |
| **DPA with processors** | Supabase + Plaid data processing agreements in place |
| **Data Protection Officer** | Contact: dpo@tournacent.com |
| **Right to access** | Data export within 30 days |
| **Right to deletion (RTBF)** | §6.2 above; exceptions for legal holds documented |
| **Data breach notification** | 72-hour notification to GDPR authority if 500+ EU residents affected |
| **Data Transfer** | US-based storage; Privacy Shield + Standard Contractual Clauses in place |

---

## 11. Exceptions to Deletion

**We CANNOT delete** the following, even if requested, due to legal or contractual obligations:

| Data | Reason | Duration |
|------|--------|----------|
| Financial transactions | IRS tax compliance | 7 years |
| Buy-in / payout records | Accounting, chargebacks | 7 years |
| Fraud investigation records | Pattern detection, legal defense | 3 years from closure |
| Subpoena-ordered data | Court order | Per court order (often indefinite) |
| Active dispute data | Chargebacks, legal claims | Until resolved + 1 year |

**User is notified** that these exceptions apply and why.

---

## 12. Audit & Monitoring

### 12.1 Deletion Audit Log

Every deletion is logged:

```sql
CREATE TABLE deletion_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  deletion_type text, -- 'account' | 'photo' | 'form' | etc.
  data_tables_affected text[],
  initiated_by text, -- 'user' | 'system_cron' | 'legal_request'
  deleted_at timestamptz DEFAULT now()
);
```

**Retention:** 3 years (legal requirement)  
**Access:** Finance + legal team only; audited quarterly

### 12.2 Quarterly Compliance Review

- [ ] Verify all automated deletion jobs executed successfully
- [ ] Audit manual deletion requests and approvals
- [ ] Check that 7-year financial data is in cold storage, not hot DB
- [ ] Confirm no data is retained beyond documented periods
- [ ] Test user-initiated deletion workflow end-to-end

---

## 13. Contact & Requests

| Request Type | Email | Max Response |
|--------------|-------|------------|
| Delete my account | privacy@tournacent.com | 24 hours to initiate; 30 days for full hard delete |
| Access my data | privacy@tournacent.com | 30 days |
| Correct inaccurate data | privacy@tournacent.com | 30 days |
| Opt-out of future marketing | unsubscribe link in email | Immediate |
| GDPR / legal inquiry | dpo@tournacent.com | 30 days |

---

## 14. Policy Review Schedule

- **Quarterly:** Review data retention metrics; ensure deletion jobs are running
- **Annually:** Update this policy to reflect legal changes (NY, CA, federal)
- **On regulatory change:** Immediate policy update if new laws passed

---

**Last Updated: 2026-04-22**  
**Next Review: 2026-07-22**

---

## Appendix: Retention Summary Table

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Account (email, password, name) | Until deletion | Authentication |
| Plaid token | Until unlink / account deletion | API auth |
| Bank transactions | 7 years | IRS tax law |
| Task submissions (photos, forms, quiz) | 30 days post-challenge | Verification |
| Points history | 1 year | Audit trail |
| Account balances | 90 days | Fraud detection |
| Crash reports | 90 days | Bug fixing |
| Support tickets | 3 years | Legal defense |
| Fraud investigation | 3 years | Pattern detection |
