# Consent Management & User Data Rights

**Effective Date:** [INSERT LAUNCH DATE]  
**Last Updated:** 2026-04-22  
**Compliant with:** CCPA, GDPR, NY SHIELD Act, COPPA

---

## 1. Consent Requirements Overview

Under CCPA, GDPR, and NY SHIELD Act, **affirmative, informed consent** is required before:

1. **Collecting personal information** (email, name, device ID)
2. **Processing financial data** (via Plaid)
3. **Storing sensitive data** (transactions, balances)
4. **Sharing data with third parties** (Plaid, Supabase, analytics)
5. **Using data for secondary purposes** (analytics, marketing)

**Key principle:** Consent must be **opt-in** (not opt-out), **specific** (not blanket), and **documented** (audit trail).

---

## 2. Consent Types & Timing

### 2.1 Account Creation Consent

**When:** Signup flow, before account is created  
**What:** Basic data collection (email, name, password)  
**Legal basis:** GDPR Lawful Basis: Consent (CCPA: User consent)

```
┌─────────────────────────────────────────────────────────┐
│  SIGNUP SCREEN 1: Email + Name + Password              │
│                                                         │
│  After user fills form:                                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ✓ CONSENT MODAL: Terms & Data Collection          │ │
│  │                                                   │ │
│  │ We collect:                                       │ │
│  │ • Email (required for login)                      │ │
│  │ • Display name (for leaderboard)                  │ │
│  │ • Device info (to prevent fraud)                  │ │
│  │                                                   │ │
│  │ We store your data securely and do not share      │ │
│  │ with third parties except Supabase (hosting).     │ │
│  │                                                   │ │
│  │ [Read Full Privacy Policy]                        │ │
│  │                                                   │ │
│  │ ☐ I agree to the Privacy Policy and Terms        │ │
│  │                                                   │ │
│  │ [Create Account]  [Cancel]                        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Record consent in DB:**
```sql
INSERT INTO user_consents (user_id, consent_type, version, accepted_at, ip_address)
VALUES ($1, 'account_creation', '1.0', now(), $2);
```

---

### 2.2 Plaid Link Consent (CRITICAL - Financial Data)

**When:** First time user taps "Link Bank Account" (Wallet tab)  
**What:** Explicit consent to share bank transactions, balances, account info  
**Legal basis:** CCPA: Specific purpose (task verification); GDPR: Explicit consent; NY SHIELD Act: Required for financial data

```
┌─────────────────────────────────────────────────────────┐
│  PLAID LINK CONSENT MODAL (Modal, not dismissible)    │
│                                                         │
│  🔗 LINK YOUR BANK ACCOUNT                              │
│                                                         │
│  By tapping "Connect Bank Account" below, you consent  │
│  to:                                                    │
│                                                         │
│  ✓ Tournacent accessing your bank account via Plaid    │
│  ✓ Plaid reading your transaction history (2 years)    │
│  ✓ Plaid reading your account balances                 │
│  ✓ Tournacent storing this data to verify challenges   │
│  ✓ Automatic bank data syncs when you spend           │
│                                                         │
│  Your bank login credentials are transmitted            │
│  directly to your bank and stored there, NOT with us.   │
│                                                         │
│  [Read full Financial Data Privacy Policy]             │
│  [View Plaid Privacy Policy]                           │
│  [View Plaid Terms]                                    │
│                                                         │
│  We use this data ONLY to:                              │
│  • Verify savings/spending tasks                        │
│  • Detect no-spend streak violations                    │
│  • Calculate your ranking                              │
│                                                         │
│  You can disconnect your bank at any time:              │
│  Wallet → Connected Accounts → [Bank] → Disconnect     │
│                                                         │
│  ☐ I consent to Plaid data access                      │
│  ☐ I understand my data is encrypted at rest           │
│  ☐ I have read the Privacy Policy                      │
│                                                         │
│  [Connect Bank Account]  [Cancel]                      │
│                                                         │
│  (Disabled until all 3 boxes checked)                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Record consent in DB:**
```sql
INSERT INTO user_consents (user_id, consent_type, version, accepted_at, ip_address, consent_string)
VALUES (
  $1, 
  'plaid_financial_data', 
  '1.0', 
  now(), 
  $2,
  'Explicit consent to Plaid data access for task verification; acknowledged financial data encryption and privacy policy'
);
```

---

### 2.3 Analytics & Crash Reporting Consent

**When:** After account creation (Settings tab)  
**What:** Opt-in consent to send usage analytics and crash reports  
**Legal basis:** CCPA: Legitimate interest (with opt-out); GDPR: Consent (default off)

```
┌─────────────────────────────────────────────────────────┐
│  SETTINGS → PRIVACY                                     │
│                                                         │
│  DATA & ANALYTICS                                      │
│                                                         │
│  ☐ Send usage analytics (tap count, screen views)      │
│    Helps us improve the app. No personal info shared.   │
│                                                         │
│  ☐ Send crash reports                                   │
│    Automatically send error logs to fix bugs.           │
│                                                         │
│  (Both default OFF on first login)                     │
│                                                         │
│  [Learn more]                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Record consent:**
```sql
UPDATE user_consents 
SET analytics_enabled = true, crash_reports_enabled = true
WHERE user_id = $1;
```

---

### 2.4 Marketing & Email Consent

**When:** After account creation; in every marketing email  
**What:** Opt-in to promotional emails, product updates, announcements  
**Legal basis:** CCPA/GDPR: Explicit opt-in (no pre-checked boxes)

```
┌─────────────────────────────────────────────────────────┐
│  SETTINGS → NOTIFICATIONS                              │
│                                                         │
│  EMAIL PREFERENCES                                     │
│                                                         │
│  ☐ Promotional emails (new challenges, special offers) │
│  ☐ Weekly digest (leaderboard standings, tips)         │
│  ☐ Product announcements                               │
│                                                         │
│  (All default OFF unless user explicitly opts in)      │
│                                                         │
│  [Manage preferences at any time]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Consent Proof & Audit Trail

**Every consent action must be logged with:**

```typescript
interface ConsentRecord {
  id: uuid;
  user_id: uuid;
  consent_type: 'account_creation' | 'plaid_financial_data' | 'analytics' | 'marketing';
  version: string;               // e.g., "1.0", "2.0"
  accepted: boolean;
  accepted_at: timestamp;
  ip_address: string;
  user_agent: string;           // Browser/OS/device
  consent_string: text;         // Full text user saw
  withdrawn_at?: timestamp;     // If user opts out later
}
```

**Database schema:**

```sql
CREATE TABLE user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  version text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  ip_address inet,
  user_agent text,
  consent_string text,
  withdrawn_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Unique: one active consent per type per user
CREATE UNIQUE INDEX user_consents_active_idx 
  ON user_consents(user_id, consent_type) 
  WHERE withdrawn_at IS NULL;

-- RLS: users can view own consents; service role can insert
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 4. Plaid Link Specific Flow (Detailed)

Plaid Link integration with **explicit consent before linking:**

### Step 1: User Navigates to Wallet

```typescript
// app/(tabs)/wallet.tsx
function WalletTab() {
  return (
    <View>
      <Button onPress={handleLinkBank}>
        Link Bank Account
      </Button>
    </View>
  );
}
```

### Step 2: Show Plaid Consent Modal (Before Opening Plaid Link)

```typescript
function handleLinkBank() {
  // 1. Check if user has already consented to Plaid
  const { data: consent } = await supabase
    .from('user_consents')
    .select('*')
    .eq('user_id', user.id)
    .eq('consent_type', 'plaid_financial_data')
    .eq('withdrawn_at', null)
    .single();

  if (!consent) {
    // 2. If NO consent, show modal
    setShowPlaidConsentModal(true);
    return;
  }

  // 3. If consent exists, open Plaid Link directly
  openPlaidLink();
}

function PlaidConsentModal() {
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);

  const canProceed = consent1 && consent2 && consent3;

  async function handleAccept() {
    // Record consent in DB
    const { error } = await supabase
      .from('user_consents')
      .insert([{
        user_id: user.id,
        consent_type: 'plaid_financial_data',
        version: '1.0',
        accepted: true,
        accepted_at: new Date(),
        ip_address: await getClientIP(), // Requires backend helper
        user_agent: getUserAgent(),
        consent_string: PLAID_CONSENT_TEXT_V1,
      }]);

    if (!error) {
      // Open Plaid Link
      openPlaidLink();
    }
  }

  return (
    <Modal visible={showPlaidConsentModal} animationType="slide">
      <ScrollView>
        <Text style={styles.title}>Link Your Bank Account</Text>
        
        <Text style={styles.body}>
          By tapping "Connect Bank Account", you consent to:
          {'\n'}✓ Tournacent accessing your bank via Plaid
          {'\n'}✓ Plaid reading your transaction history & balances
          {'\n'}✓ Tournacent storing this data securely
        </Text>

        <Checkbox
          label="I consent to Plaid data access"
          value={consent1}
          onChange={setConsent1}
        />
        <Checkbox
          label="I understand my data is encrypted"
          value={consent2}
          onChange={setConsent2}
        />
        <Checkbox
          label="I have read the Privacy Policy"
          value={consent3}
          onChange={setConsent3}
          onPress={() => openPrivacyPolicy()}
        />

        <Button
          onPress={handleAccept}
          disabled={!canProceed}
        >
          Connect Bank Account
        </Button>
      </ScrollView>
    </Modal>
  );
}
```

---

## 5. Consent Withdrawal (User Right to Opt-Out)

Users can withdraw consent at any time. When they do:

### 5.1 Withdraw Plaid Consent

**Path:** Wallet → Connected Accounts → [Bank] → Disconnect

```typescript
async function handleDisconnectBank() {
  // 1. Revoke Plaid access token
  const { error: revokeError } = await supabase.functions.invoke('revoke-plaid-access', {
    body: { item_id: plaidItem.id }
  });

  if (!revokeError) {
    // 2. Record consent withdrawal
    const { error: withdrawError } = await supabase
      .from('user_consents')
      .update({ withdrawn_at: new Date() })
      .eq('user_id', user.id)
      .eq('consent_type', 'plaid_financial_data');

    // 3. Delete access token from DB
    await supabase
      .from('plaid_items')
      .update({ access_token: null })
      .eq('id', plaidItem.id);

    // 4. Show confirmation
    Alert.alert('Bank Disconnected', 'Your account is disconnected. Plaid tasks can no longer be verified.');
  }
}
```

**DB entry:**
```sql
UPDATE user_consents 
SET withdrawn_at = now() 
WHERE user_id = $1 AND consent_type = 'plaid_financial_data' AND withdrawn_at IS NULL;
```

### 5.2 Withdraw Analytics Consent

**Path:** Settings → Privacy → Disable Analytics

```typescript
async function toggleAnalytics(enabled: boolean) {
  if (!enabled) {
    // Record withdrawal
    await supabase
      .from('user_consents')
      .update({ withdrawn_at: now() })
      .eq('user_id', user.id)
      .eq('consent_type', 'analytics');
  }
  
  // Stop sending analytics
  disableExpoAnalytics();
}
```

---

## 6. Consent Version Management

When consent terms change, a **new version** is required.

### Version 1.0 → Version 2.0 (Example: Added encryption disclosure)

```sql
-- Old consent expires
UPDATE user_consents
SET withdrawn_at = now()
WHERE consent_type = 'plaid_financial_data' AND version = '1.0';

-- User sees new consent modal on next visit
SELECT COUNT(*) FROM user_consents
WHERE user_id = $1 
  AND consent_type = 'plaid_financial_data' 
  AND withdrawn_at IS NULL;
-- Result: 0 → trigger new modal

-- New consent recorded
INSERT INTO user_consents (...)
VALUES (..., version = '2.0', ...);
```

**In code:**

```typescript
// Constant for current consent version
const PLAID_CONSENT_VERSION = '1.0';

async function checkConsentStatus() {
  const { data } = await supabase
    .from('user_consents')
    .select('*')
    .eq('user_id', user.id)
    .eq('consent_type', 'plaid_financial_data')
    .eq('withdrawn_at', null);

  const hasValidConsent = data?.some(
    c => c.version === PLAID_CONSENT_VERSION
  );

  if (!hasValidConsent) {
    // Show consent modal (new version)
    setShowPlaidConsentModal(true);
  }
}
```

---

## 7. Consent UI Requirements (Best Practices)

### What to Avoid ❌

- Pre-checked boxes (should be unchecked by default)
- Bundled consent ("accept all" without option to reject)
- Burying consent in 50-page terms
- Requiring consent for non-essential features
- Dark patterns (e.g., "Accept" is green, "Decline" is gray)
- Auto-opening Plaid Link before consent is given

### What to Do ✅

- Clear, separate consent for each purpose
- Plain language (not legal jargon)
- Explicit checkboxes (not just reading the page)
- Easy withdrawal (Settings → 1 tap to disable)
- Privacy policy linked and readable in-app
- Consent recorded with IP + timestamp
- Show what will happen if user consents vs. declines

---

## 8. Consent for Edge Functions (Server-Side)

When Edge Functions process Plaid data, consent applies transitively:

**Edge Function pseudocode:**

```typescript
// supabase/functions/sync-transactions/index.ts
async function syncTransactions(userId, itemId) {
  // 1. Check user has active Plaid consent
  const consent = await db
    .from('user_consents')
    .select('*')
    .eq('user_id', userId)
    .eq('consent_type', 'plaid_financial_data')
    .eq('withdrawn_at', null)
    .single();

  if (!consent) {
    return { error: 'User has not consented to Plaid data access' };
  }

  // 2. Proceed with sync
  // ... fetch transactions from Plaid, insert to bank_transactions
}
```

---

## 9. COPPA Compliance (Users Under 13)

If serving US users under 13:

```typescript
// Signup consent for children
function ChildSignupConsent() {
  return (
    <View>
      <Text>
        You must be 13 or older to use Tournacent.
      </Text>
      <Text>
        By creating an account, you confirm you are 13+.
      </Text>
      <Checkbox
        label="I am 13 years old or older"
        required={true}
      />
      <Text style={styles.smaller}>
        If you are under 13, a parent or guardian must consent to your use of this app.
        [Parent Consent Link]
      </Text>
    </View>
  );
}
```

---

## 10. Consent Reporting (Audit & Compliance)

### Monthly Audit Query

```sql
-- How many users consented to Plaid?
SELECT 
  DATE(accepted_at) as date,
  COUNT(DISTINCT user_id) as plaid_consents
FROM user_consents
WHERE consent_type = 'plaid_financial_data'
  AND accepted = true
GROUP BY DATE(accepted_at)
ORDER BY date DESC;

-- How many users have withdrawn Plaid consent?
SELECT 
  COUNT(DISTINCT user_id) as withdrawals
FROM user_consents
WHERE consent_type = 'plaid_financial_data'
  AND withdrawn_at IS NOT NULL;

-- Consents by version (compliance review)
SELECT 
  version,
  COUNT(DISTINCT user_id) as user_count
FROM user_consents
WHERE consent_type = 'plaid_financial_data'
  AND withdrawn_at IS NULL
GROUP BY version;
```

### Regulatory Report (For NY SHIELD Act Audit)

```
Tournacent Consent Report (Q2 2026)

Total Users: 5,234
Plaid Consent Status:
  - Consented (current): 3,847 (73%)
  - Withdrawn: 156 (3%)
  - Never consented: 1,231 (24%)

Consent Proof:
  - Records with IP address: 3,847/3,847 (100%)
  - Records with timestamp: 3,847/3,847 (100%)
  - Records with user-agent: 3,847/3,847 (100%)

Consent Versions:
  - v1.0: 3,800 users
  - v2.0: 47 users

Withdrawal Trends:
  - Rate: 1.2% per month
  - Reasons logged: [data from support tickets]

Conclusion: All users have explicit, documented consent for Plaid data access.
```

---

## 11. Implementation Checklist

Before launching Plaid to production:

- [ ] `user_consents` table created + RLS enabled
- [ ] Plaid consent modal implemented (not dismissible until all checkboxes checked)
- [ ] Consent recorded to DB with IP + timestamp + user-agent
- [ ] Consent version logic implemented (v1.0, v2.0, etc.)
- [ ] Privacy Policy linked in Settings + fully readable in-app
- [ ] Plaid consent required before Edge Function can sync data
- [ ] Withdraw consent button in Wallet (disconnect bank)
- [ ] Analytics/crash reporting toggle in Settings (default OFF)
- [ ] Marketing email opt-in in Settings (default OFF)
- [ ] Monthly audit query added to compliance checklist
- [ ] Edge Functions check for valid consent before processing
- [ ] Support emails route consent requests to dpo@tournacent.com

---

## 12. Legal Language: Plaid Consent Text (Required)

Use this exact text (or approved variation) in the modal:

```
TOURNACENT PLAID DATA SHARING CONSENT

By clicking "Connect Bank Account", you authorize Tournacent to:

1. Connect to your bank account via Plaid
2. Access your account information (numbers, balances)
3. Read your transaction history (typically 2 years)
4. Access data in real-time as you make purchases
5. Store this data in Tournacent's database to verify challenges

Your bank login credentials are transmitted directly to your bank 
and stored there, NOT by Tournacent.

Tournacent will use this data ONLY to:
• Verify savings/spending tasks
• Detect no-spend streak violations
• Calculate your challenge ranking
• Detect fraud

You can revoke this access at any time by disconnecting your bank 
in Wallet → Connected Accounts → [Bank] → Disconnect.

Revocation is effective immediately. Plaid will stop syncing new 
transactions, but existing transaction records are retained per 
our 7-year retention policy for tax compliance.

By checking the boxes below, you consent to the above and have 
read our Privacy Policy and Plaid's Privacy Policy.
```

---

**Last Updated: 2026-04-22**
