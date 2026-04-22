# Tournacent Privacy Policy

**Effective Date:** [INSERT LAUNCH DATE]  
**Last Updated:** 2026-04-22

---

## 1. Introduction

Tournacent ("**App**," "**we**," "**us**," "**our**") is a financial literacy challenge app that helps users build savings, reduce debt, and improve financial habits through gamified challenges.

This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our App and services ("**Services**"). Please read this policy carefully. **If you do not agree with our practices, do not use our App.**

---

## 2. Information We Collect

### 2.1 Information You Provide Directly

| Category | Purpose | Examples |
|----------|---------|----------|
| **Account Information** | Create and authenticate your account | Email address, display name, password |
| **Financial Data** | Verify task completion and calculate challenges | Bank transactions, account balances via Plaid |
| **Task Submissions** | Process challenge tasks | Photos, quiz answers, form responses, text entries, counter progress |
| **Device Information** | Optimize app experience | Device OS, app version, device identifier (via Expo) |
| **Location Information** | None collected | We do not request or collect location data |

### 2.2 Information Collected Automatically

| Data | How Collected | Purpose |
|------|---------------|---------|
| Usage analytics | Expo Analytics | Understand user behavior, identify bugs, improve UX |
| Crash reports | Expo error tracking | Fix bugs and stability issues |
| API call logs | Supabase logs | Monitor service health and security |
| IP address | Server logs | Fraud detection, rate limiting |

### 2.3 Third-Party Data Collection (Plaid)

When you link a bank account via **Plaid Link**, Plaid collects:
- Bank login credentials (transmitted securely to your bank, not stored by us)
- Account numbers
- Transaction history (past 2 years)
- Account balances

**Plaid's Privacy Policy:** https://plaid.com/legal/privacy/

We do not control Plaid's data practices. Linking a bank account constitutes consent to Plaid's terms.

---

## 3. How We Use Your Information

| Use Case | Legal Basis | Retention |
|----------|------------|-----------|
| **Task verification** | Contractual (challenge gameplay) | Duration of challenge + 30 days |
| **Leaderboard rankings** | Contractual (competitive feature) | Duration of challenge + 30 days |
| **Prize distribution** | Contractual (payment obligation) | Until payout + 7 years (tax/fraud) |
| **Security & fraud prevention** | Legal obligation + legitimate interest | As long as account exists |
| **Customer support** | Contractual | Until issue resolved + 1 year |
| **Legal compliance** | Legal obligation | Per applicable law (see §8) |
| **App improvement** | Legitimate interest (anonymized analytics) | Until no longer useful (typically 1 year) |

### 3.1 What We Do NOT Do

- ❌ Sell your personal information to third parties
- ❌ Use your financial data for marketing or targeted advertising
- ❌ Share your bank login credentials with anyone
- ❌ Create a credit profile or affect your credit score
- ❌ Use your data to train AI models without explicit consent

---

## 4. Data Sharing

### 4.1 We Share Information With

| Party | What | Why | Legal Basis |
|-------|------|-----|-------------|
| **Plaid** | Bank login, account info | Fetch transactions | Service provider agreement |
| **Supabase** | All user data | Database hosting | Service provider agreement |
| **Law enforcement** | Personal info, transaction data | Subpoena, court order | Legal obligation |
| **Payment processor** (future) | Name, email, buy-in amount | Process payments | Service provider agreement |

### 4.2 We Do NOT Share

- ❌ Your bank credentials (Plaid transmits directly to banks)
- ❌ Your email with marketing partners
- ❌ Identifiable transaction details with third parties
- ❌ Data with advertisers or data brokers

### 4.3 Aggregate/Anonymous Data

We may share anonymized, aggregate statistics (e.g., "Average savings per user is $500") with researchers or partners. This cannot identify you.

---

## 5. Data Security

We implement industry-standard protections:

| Control | Implementation |
|---------|-----------------|
| **Encryption in transit** | TLS 1.2+ for all API calls |
| **Encryption at rest** | Plaid tokens encrypted server-side (pgcrypto) |
| **Access control** | Row-level security (RLS) on all tables |
| **Authentication** | JWT sessions; hardware-backed SecureStore on mobile |
| **Audit logging** | Supabase audit logs for all admin actions |
| **Incident response** | Documented playbook; breach notification within 30 days |

**However,** no security is perfect. We cannot guarantee absolute protection against hacking, social engineering, or insider threats.

---

## 6. Your Privacy Rights

### 6.1 Right to Access

You can request a copy of all personal information we hold about you. We will provide it in machine-readable format within 30 days.

**How to request:** Email privacy@tournacent.com with subject line "Data Access Request"

### 6.2 Right to Deletion ("Right to be Forgotten")

You can request deletion of your account and associated data. We will delete:
- ✅ Your profile, email, display name
- ✅ Task submissions (photos, forms, quiz answers)
- ✅ Challenge participation records
- ✅ Plaid link (access token revoked immediately)
- ❌ Transactions > 7 years old (retained for tax purposes per §8)
- ❌ Fraud investigation data (if active)

Deletion is permanent and non-recoverable. Your leaderboard ranking will be anonymized.

**How to request:** Settings → Account → Delete Account → Confirm

Deletion will be processed within 30 days.

### 6.3 Right to Correction

You can update your email, display name, and other profile information in Settings.

If you believe we have inaccurate financial data (e.g., duplicate transactions), contact privacy@tournacent.com.

### 6.4 Right to Data Portability

You can export your challenge history, task submissions, and aggregate statistics in JSON format.

**How to request:** Settings → Download My Data (automated)

### 6.5 Right to Opt-Out

- **Analytics:** Settings → Privacy → Disable analytics sharing (will remain disabled until you re-enable)
- **Crash reports:** Settings → Privacy → Disable crash reporting
- **Marketing emails:** Unsubscribe link in every email

### 6.6 Right to Appeal

If we deny your request, you can appeal to our Data Protection Officer at privacy@tournacent.com within 30 days.

---

## 7. Children & COPPA

Tournacent is not directed at children under 13. We do not knowingly collect information from children under 13.

If we discover we have collected information from a child under 13, we will delete it immediately and notify the parent/guardian.

**For Tournaments serving US users:** App will include age gate at signup (you must be 13+).

---

## 8. Data Retention & Legal Compliance

### 8.1 New York SHIELD Act Compliance

Tournacent complies with the **New York SHIELD Act** (NY Gen. Bus. Law § 668-f), which requires:

| Requirement | Our Implementation |
|-------------|-------------------|
| Reasonable security | §5 above; annual third-party audit (pending) |
| Data minimization | Only collect data necessary for gameplay |
| Breach notification | Notify affected users within 30 days (§8.3) |
| Secure deletion | Overwrite with cryptographic zeros (3-pass) |
| User consent | In-app consent modal before Plaid Link |

### 8.2 General Data Retention Schedule

| Data Type | Retention Period | Legal Basis |
|-----------|-----------------|------------|
| **Active account data** | Until account deletion | Contractual |
| **Deleted account data** | 30 days (backup recovery window) | Legitimate interest |
| **Financial transactions** | 7 years | Tax compliance (IRS) |
| **Fraud investigation records** | 3 years after resolution | Legal obligation |
| **Audit logs** | 1 year | Security compliance |
| **Crash reports** | 90 days | App improvement |
| **Analytics** | 1 year (aggregated) | Business intelligence |

### 8.3 Data Breach Notification

If we suffer a data breach affecting your personal information:

1. **Notify you within 30 days** via email to the address on file
2. **Describe what happened** — type of data, number of affected users
3. **Describe mitigation** — what we're doing to prevent future breaches
4. **Recommend actions** — e.g., monitor credit, change passwords
5. **Notify regulators** — NY Attorney General if 500+ NY residents affected

---

## 9. Cookies & Tracking

### 9.1 Mobile App

Tournacent mobile app uses **no cookies**. Session tokens are stored securely in hardware-backed storage (`expo-secure-store`).

### 9.2 Web App

If accessed via web browser, we use:

- **Session cookie** — stores JWT token; deleted on logout
- **Preference cookie** — stores theme (light/dark); not synced to servers
- **Analytics cookie** — Expo Analytics opt-in (disabled by default)

No third-party cookies (Google Analytics, Facebook Pixel, etc.).

---

## 10. Third-Party Links

Our App may contain links to third-party services:
- Plaid (financial data provider)
- App Store / Play Store links
- External educational resources

We are **not responsible** for their privacy practices. Please review their policies before sharing information.

---

## 11. International Users

Tournacent is operated from the United States and stores data on Supabase (US-based). If you access the App from outside the US, you consent to your data being transferred to and processed in the United States, which may have different privacy laws than your country.

**GDPR (EU users):** If you are an EU resident, your data is protected under GDPR. You have the right to lodge a complaint with your national data protection authority.

---

## 12. Contact Us

### Privacy Questions
Email: **privacy@tournacent.com**  
Response time: 10 business days

### Data Deletion Requests
Email: **privacy@tournacent.com** or use in-app Settings → Delete Account

### Data Protection Officer (DPO)
Title: Privacy Officer  
Email: dpo@tournacent.com  
Available for: GDPR/SHIELD Act inquiries

### Mailing Address
```
Tournacent Privacy Team
[INSERT LEGAL ENTITY ADDRESS]
[CITY, STATE, ZIP]
```

---

## 13. Policy Changes

We may update this Privacy Policy from time to time. If we make **material changes** (e.g., new data sharing, retention policy changes), we will:

1. Notify you via email (to address on file)
2. Post the updated policy in Settings → Privacy Policy
3. Require re-consent if you have not agreed to new terms

**Changes take effect immediately upon posting.** Continued use of the App constitutes acceptance.

You can see the version history on our website: tournacent.com/privacy-versions

---

## 14. California Privacy Rights (CCPA / CPRA)

If you are a California resident, you have additional rights:

| Right | How to Exercise |
|------|------------------|
| Know what data we collect | Privacy Policy + Data Access Request |
| Delete personal information | Settings → Delete Account |
| Opt-out of data sales | We don't sell data, so N/A |
| Correct inaccurate data | Settings → Edit Profile |
| Limit use of sensitive data | Settings → Privacy → Restrict to necessary purposes only |

**No discrimination:** We will not discriminate against you for exercising these rights.

---

## Appendix A: Plaid-Specific Terms

### Plaid Permissions

When you tap "Link Bank Account," you authorize Plaid to:
- ✅ Read account and balance information
- ✅ Read transaction history (typically 2 years)
- ✅ Access data in real-time

You authorize **us** to:
- ✅ Use transactions to verify task completion
- ✅ Store transaction data in our database (encrypted)
- ❌ Share transaction data with anyone else

### Revoking Plaid Access

You can disconnect your bank account at any time:

**In-App:** Wallet → Connected Accounts → [Bank] → Disconnect

**Plaid Dashboard:** https://mysettings.plaid.com (manage all your Plaid connections)

When disconnected:
- ✅ New transactions no longer synced
- ✅ We can no longer verify Plaid-based tasks
- ❌ Existing transaction data is not deleted (per tax retention policy)
- ❌ You cannot re-link the same account without starting fresh

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Personal Information** | Any data that identifies or could identify you (email, name, IP address, etc.) |
| **Sensitive Personal Information** | Financial data, health info, precise location, biometrics |
| **Processing** | Any operation on data (collect, store, use, disclose, delete) |
| **Data Subject** | You (the person whose data is being processed) |
| **Data Controller** | Us (Tournacent; responsible for why/how data is processed) |
| **Data Processor** | Third parties we hire (Supabase, Plaid; process data on our behalf) |
| **Legitimate Interest** | A reason to process data that is not contractual or legal (e.g., fraud prevention) |

---

**This Privacy Policy is binding on Tournacent and all its employees, contractors, and service providers.**

Last Updated: **2026-04-22**
