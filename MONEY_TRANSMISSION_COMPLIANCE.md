# Money Transmission & KYC/AML Compliance

**Assessment Date:** 2026-04-22  
**Jurisdiction:** New York (primary focus) + Federal (FinCEN)  
**Current Status:** Simulated payments (no real money moving)  
**Risk Level:** 🔴 **CRITICAL** — Licensing required before real payments

---

## 1. Executive Summary

**TL;DR:**

- **Current Status:** Simulated payments = ✅ NO licensing required yet
- **At Real Money:** = 🔴 **IMMEDIATELY triggers** money transmission licensing requirements
- **Threshold:** **$0** — The moment you accept real buy-ins or distribute real payouts, you're a money transmitter
- **Licensing Timeline:** 6-12 months (NY requires extensive compliance program)
- **KYC/AML Triggers:** Every transaction, starting at $1
- **Security Impact:** Requirements escalate dramatically (see §7)

---

## 2. Money Transmission Definition

### 2.1 What Constitutes Money Transmission?

**FinCEN & State Definition:**

> "Money transmission" = Accepting money/value from one person and sending an equivalent value to another person

**Tournacent's situation:**

| Activity | Classification | Requires License? |
|----------|----------------|-------------------|
| **Accepting buy-in payments** | Receiving money from users | 🔴 **YES** |
| **Holding prize pool** | Storing other people's money | 🔴 **YES** |
| **Distributing payouts** | Sending money to winners | 🔴 **YES** |
| **Collecting entry fees** | Receiving value | 🔴 **YES** |
| **Escrow (holding money in trust)** | Custody of funds | 🔴 **YES** |

**Even if you don't "transmit," you're still a money transmitter if you:**
- Accept customer funds (deposits)
- Hold funds (even temporarily)
- Distribute funds (payouts)

**Conclusion:** ✅ Currently safe (simulated). 🔴 Any real money = licensing required.

---

## 3. Federal Licensing: FinCEN (Financial Crimes Enforcement Network)

### 3.1 FinCEN Registration

**Requirement:** All US money transmitters must register with **FinCEN** (part of US Treasury).

| Item | Requirement |
|------|-------------|
| **Who** | Any entity transmitting money in the US |
| **Cost** | $0 (free registration) |
| **Form** | FinCEN Form 107 (Money Services Business Registration) |
| **Frequency** | Register once; renew biennially (every 2 years) |
| **Timeline** | Must register BEFORE accepting money |
| **Penalty** | Up to $25,000 + criminal liability if not registered |

**Registration location:** https://msb.fincen.gov/

### 3.2 FinCEN Anti-Money Laundering (AML) Program

**Requirement:** Establish and maintain **AML Compliance Program**

**Minimum components:**
1. **Policies & Procedures** — written, documented
2. **Compliance Officer** — appointed, responsible for AML program
3. **Training Program** — all employees trained annually
4. **Independent Audit** — annual third-party audit of AML program
5. **Customer Identification Program (CIP)** — KYC (see §4)
6. **Customer Due Diligence (CDD)** — enhanced KYC for high-risk users
7. **Suspicious Activity Reporting (SAR)** — report transactions >$10K or suspicious behavior
8. **Currency Transaction Reporting (CTR)** — report cash transactions >$10K to FinCEN

**Recordkeeping:** Maintain all transaction records for 5 years.

---

## 4. State Licensing: New York BitLicense

### 4.1 New York's Virtual Currency License (BitLicense)

**Jurisdiction:** New York Department of Financial Services (NYDFS)

**Requirement:** If Tournacent involves **virtual currency, money transmission, or custodied digital assets**, you need a **BitLicense** or **money transmission license**.

| Aspect | Requirement |
|--------|------------|
| **Applies to** | Entities handling money/assets in NY |
| **Cost** | $5,000 application fee + annual license fee (~$500-5,000) |
| **Timeline** | 6-12 months review process (complex) |
| **Capital Requirement** | ~$5,000 - $50,000 (depends on business model) |
| **Approval Authority** | NY Department of Financial Services (NYDFS) |
| **Penalty** | Up to $1,000/day per violation; license revocation |

### 4.2 New York Money Transmission License (Alternative)

If Tournacent is **NOT** using digital assets, a traditional **Money Transmission License** may be simpler:

| Aspect | BitLicense | Money Transmission |
|--------|-----------|-------------------|
| **Applies to** | Digital currency, virtual assets | Fiat currency (USD) |
| **Application Complexity** | Very Complex (50+ page application) | Complex (20-30 page application) |
| **Timeline** | 12+ months | 6-9 months |
| **Capital Requirement** | $5,000 - $50,000 | $5,000 - $25,000 |
| **Ongoing Requirements** | Enhanced AML, exam readiness | Standard AML, exams every 2-3 years |
| **Tournacent Fit** | ❌ Not applicable (using USD) | ✅ **APPLICABLE** (handling USD buy-ins/payouts) |

**Recommendation:** Tournacent needs **NY Money Transmission License** (not BitLicense).

### 4.3 NY Money Transmission License Requirements

**Application includes:**
1. Business plan (5-10 pages)
2. Organizational structure + key personnel bios
3. AML/CFT (Countering Financing of Terrorism) program (detailed)
4. Customer identification procedures (CIP)
5. Background checks for all executives
6. Net worth/capital adequacy documentation
7. Insurance requirements (coverage for crime, fraud)
8. Cybersecurity & data protection plan
9. Disaster recovery & business continuity plan
10. Complaint handling procedures

**Annual requirements:**
- File annual report with NYDFS
- Pass on-site examination every 2-3 years (auditor visits)
- Maintain net worth/capital requirement
- Report suspicious activities (SARs) to FinCEN

### 4.4 Other State Licenses

**If expanding beyond NY:**

| State | License | Cost | Timeline | Difficulty |
|-------|---------|------|----------|------------|
| **California** | Money Transmitter | $1,000-5,000 | 6-9 months | Medium |
| **Texas** | Money Services License | $1,000-2,000 | 4-6 months | Low-Medium |
| **Florida** | Money Transmitter | $2,000 | 3-6 months | Low-Medium |
| **Illinois** | License | $3,000 | 6-9 months | Medium |
| **New Jersey** | License | $2,000 | 6-9 months | Medium |

**Total cost (all US states):** ~$50,000 - $150,000 + 18-24 months

---

## 5. KYC (Know Your Customer) Requirements

### 5.1 Customer Identification Program (CIP)

**Requirement:** Collect & verify identity before or during onboarding.

**Collect (at account creation):**
1. **Full name** — legal name
2. **Date of birth**
3. **Address** — current residential address
4. **Government ID number** — SSN (for US) or passport number (international)
5. **Phone number**
6. **Email address**

**Verify (before accepting money):**
- Cross-check against identity documents (government ID photo)
- Verify with credit bureau / identity verification service
- Example service: Plaid Identity Verification, Jumio, Socure

**Timeline:** Complete before first transaction.

### 5.2 Customer Due Diligence (CDD) — Enhanced KYC

**Triggers:** High-risk customers or transactions >$10,000

**Collect additional info:**
1. **Source of funds** — where does money come from?
2. **Purpose of activity** — why are they using Tournacent?
3. **Beneficial ownership** — who actually owns the funds? (for business accounts)
4. **PEP (Politically Exposed Persons)** — sanction screening
5. **Occupation** — employment info
6. **Expected transaction volume** — how much will they spend?

**Screening:**
- Screen against OFAC (Office of Foreign Assets Control) sanction lists
- Screen against FBI Most Wanted list
- Screen against FinCEN enforcement actions

**Example OFAC screening service:** Oracle NetSuite, Actifi, ComplyAdvantage

### 5.3 KYC Implementation for Tournacent

**Recommended flow:**

```
1. User Signs Up
   ├─ Collect: name, DOB, address, SSN, email, phone
   └─ Verification: Connect to identity service (Plaid, Jumio)

2. User Tries to Add Buy-In Payment
   ├─ If amount < $10K: proceed
   └─ If amount ≥ $10K: trigger CDD
       ├─ Ask: source of funds
       ├─ Ask: purpose
       └─ Screen: OFAC sanction lists

3. FinCEN SAR Triggers (after account creation)
   ├─ Suspicious pattern detected (e.g., rapid transactions)
   └─ File Suspicious Activity Report (SAR) within 30 days
```

**In code:**

```typescript
// supabase/functions/process-buyin/index.ts
async function processBuyIn(userId: string, amount: number) {
  // 1. Check KYC status
  const kyc = await getKYCStatus(userId);
  if (!kyc.verified) {
    // Require identity verification before accepting money
    return { error: 'KYC verification required' };
  }

  // 2. If >$10K, require CDD
  if (amount >= 10000) {
    const cdd = await getCDDStatus(userId);
    if (!cdd.completed) {
      // Require enhanced due diligence
      return { error: 'Enhanced verification required for large transactions' };
    }
  }

  // 3. Check OFAC screening
  const ofacResult = await screenOFAC(kyc.name, kyc.dob);
  if (ofacResult.isMatch) {
    // Do NOT process; file SAR
    await fileSAR({
      userId,
      amount,
      reason: 'OFAC sanction match',
      details: ofacResult
    });
    return { error: 'Transaction cannot be processed' };
  }

  // 4. Process payment
  // ... payment logic
}
```

---

## 6. AML (Anti-Money Laundering) Requirements

### 6.1 Suspicious Activity Reporting (SAR)

**Requirement:** Report suspicious transactions to FinCEN.

**When to file SAR:**
1. **Transaction >$10,000** — mandatory reporting
2. **Multiple transactions totaling >$10,000 in 24 hours** — structured to avoid reporting
3. **Unusual patterns** — e.g., rapid buy-in then immediate payout
4. **Fraud indicators** — stolen payment method, velocity abuse
5. **PEP or sanctioned person** — identified during screening

**Timeline:** File within **30 days** of discovering suspicious activity.

**Form:** FinCEN Form 111 (Suspicious Activity Report)

**Tournacent example:**
```
User "Alice" signs up, deposits $15,000 buy-in, wins challenge, 
withdraws $45,000 payout in 2 days. Inconsistent with typical 
user behavior.

→ File SAR: Potential money laundering (rapid fund flow)
```

### 6.2 Currency Transaction Reporting (CTR)

**Requirement:** Report cash transactions >$10,000 to FinCEN.

**Applies if:** Tournacent accepts cash, wire transfers, checks.

**Tournacent status:** Not applicable (digital payments only via Stripe).

### 6.3 AML Program Documentation

**Required policies & procedures:**
1. Written AML policy (5-10 pages)
2. CIP/CDD procedures
3. Transaction monitoring procedures
4. SAR filing procedures
5. OFAC screening procedures
6. Training & testing procedures
7. Audit procedures
8. Complaint procedures
9. Record retention procedures (5 years)

**Example AML Policy outline:**

```markdown
# Tournacent AML Policy

## 1. Overview
Tournacent is committed to preventing money laundering and 
terrorist financing. This policy outlines controls.

## 2. Customer Identification (CIP)
- Collect: name, DOB, address, SSN, email, phone
- Verify: identity documentation before first transaction
- Timeline: Before processing first payment

## 3. Customer Due Diligence (CDD)
- For transactions ≥$10,000: collect source of funds, purpose
- For high-risk users: enhanced screening against OFAC

## 4. Transaction Monitoring
- Review transactions daily for suspicious patterns
- Alert on: velocity abuse, rapid payout, unusual amounts

## 5. Suspicious Activity Reporting (SAR)
- File FinCEN Form 111 if suspicious activity detected
- Timeline: Within 30 days of discovery
- Confidentiality: Do not inform customer of SAR filing

## 6. OFAC Screening
- Screen all users against OFAC Specially Designated Nationals (SDN) list
- Reject if match found; file SAR

## 7. Training
- All employees trained on AML procedures annually
- Training documented and retained
- Testing: annual quiz covering AML requirements

## 8. Audit
- Independent third-party audit annually
- Audit report provided to compliance officer
- Findings remediated within 30 days
```

---

## 7. Security Posture Changes (Impact)

### 7.1 Additional Security Requirements When Licensed

| Control | Before License | After License |
|---------|----------------|---------------|
| **KYC Verification** | Optional | 🔴 **Mandatory** |
| **OFAC Screening** | No | 🔴 **Mandatory** |
| **Audit Logging** | Basic | 🔴 **Comprehensive** (every transaction) |
| **Data Retention** | 1-7 years | 🔴 **5 years minimum** (transactions, KYC, SAR) |
| **Encryption** | Current level | 🔴 **Enhanced** (column-level for sensitive data) |
| **Access Controls** | RLS | 🔴 **Formal role-based access control** |
| **Third-party Audit** | Annual | 🔴 **Annual + exam every 2-3 years** |
| **Compliance Officer** | Optional | 🔴 **Required** (dedicated role) |
| **DPA/Agreements** | Standard | 🔴 **Enhanced** (with payment processor) |
| **Incident Response** | 30 days | 🔴 **24 hours** (breach notification) |
| **Cybersecurity Plan** | SECURITY_POLICY.md | 🔴 **Formal, detailed plan** |

### 7.2 New Tables & Fields Required

**Add to schema:**

```sql
-- KYC Verification Records
CREATE TABLE kyc_verifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL, -- 'pending' | 'verified' | 'rejected'
  verified_name text,
  verified_dob date,
  verified_ssn text, -- encrypted
  identity_document text, -- S3 path to photo
  verification_timestamp timestamptz,
  verification_provider text, -- 'Plaid' | 'Jumio' | etc.
  verification_score numeric, -- confidence level
  created_at timestamptz DEFAULT now()
);

-- Enhanced Due Diligence (for >$10K transactions)
CREATE TABLE cdd_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  source_of_funds text, -- 'salary' | 'savings' | 'gift' | etc.
  purpose text,
  occupation text,
  beneficial_owner text, -- if not individual
  cdd_timestamp timestamptz,
  created_at timestamptz DEFAULT now()
);

-- OFAC Screening Results
CREATE TABLE ofac_screening (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  screening_timestamp timestamptz,
  result text, -- 'clear' | 'match' | 'manual_review'
  match_details jsonb,
  screened_against text, -- 'SDN' | 'PEP' | etc.
  created_at timestamptz DEFAULT now()
);

-- Suspicious Activity Reports (SAR) Filed
CREATE TABLE suspicious_activity_reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  transaction_id uuid REFERENCES transactions(id),
  reason text, -- 'velocity_abuse' | 'ofac_match' | 'structured_deposits' | etc.
  amount numeric,
  details jsonb,
  filed_to_fincen boolean DEFAULT false,
  filed_timestamp timestamptz,
  fincen_reference_number text,
  created_at timestamptz DEFAULT now()
);

-- AML Compliance Events (audit trail)
CREATE TABLE aml_audit_log (
  id uuid PRIMARY KEY,
  user_id uuid,
  event_type text, -- 'kyc_verified' | 'cdd_completed' | 'sar_filed' | etc.
  event_timestamp timestamptz,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdd_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofac_screening ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_audit_log ENABLE ROW LEVEL SECURITY;
```

### 7.3 Application Changes Required

**Updated signup flow:**

```typescript
// app/(auth)/signup.tsx
async function handleSignup() {
  // 1. Create account
  const user = await signUp(email, password);

  // 2. Collect KYC info
  navigation.navigate('KYCVerification', { userId: user.id });
}

// app/(auth)/KYCVerification.tsx
function KYCVerificationScreen({ userId }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    address: '',
    ssn: '', // masked: XXX-XX-1234
    phone: '',
  });

  async function handleSubmit() {
    // 1. Encrypt sensitive data (SSN)
    const encryptedSSN = pgpSymEncrypt(formData.ssn, 'kms-key');

    // 2. Send to identity verification service (Plaid, Jumio)
    const verificationResult = await verifyIdentity(formData);

    // 3. If verified, record in DB
    if (verificationResult.verified) {
      await supabase.from('kyc_verifications').insert({
        user_id: userId,
        status: 'verified',
        verified_name: verificationResult.name,
        verified_dob: verificationResult.dob,
        verified_ssn: encryptedSSN,
        verification_provider: 'Plaid',
        verification_score: verificationResult.confidence,
      });

      // 4. Screen against OFAC
      const ofacResult = await screenOFAC(formData.firstName, formData.lastName);
      await supabase.from('ofac_screening').insert({
        user_id: userId,
        result: ofacResult.isClear ? 'clear' : 'match',
        match_details: ofacResult.matches,
      });

      if (!ofacResult.isClear) {
        // File SAR
        await fileSAR(userId, 'OFAC sanction match', ofacResult);
        return { error: 'Account cannot be created (sanctions match)' };
      }

      // 5. Navigate to next step
      navigation.navigate('AddPaymentMethod');
    }
  }

  return (
    <Form>
      <Input label="First Name" placeholder="John" />
      <Input label="Last Name" placeholder="Doe" />
      <Input label="Date of Birth" placeholder="01/15/1990" />
      <Input label="SSN" placeholder="XXX-XX-1234" masked />
      <Input label="Address" placeholder="123 Main St" />
      <Input label="Phone" placeholder="+1-555-1234" />
      <Button onPress={handleSubmit}>Verify Identity</Button>
    </Form>
  );
}
```

**Updated buy-in flow:**

```typescript
// supabase/functions/process-buyin/index.ts
async function processBuyIn(userId: string, amount: number) {
  // 1. Verify KYC completed
  const kyc = await supabase
    .from('kyc_verifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'verified')
    .single();

  if (!kyc) {
    throw new Error('KYC verification required');
  }

  // 2. If >$10K, verify CDD
  if (amount >= 10000) {
    const cdd = await supabase
      .from('cdd_records')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!cdd) {
      throw new Error('Enhanced verification required for large transactions');
    }
  }

  // 3. Check OFAC screening
  const ofac = await supabase
    .from('ofac_screening')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (ofac.result !== 'clear') {
    // File SAR: OFAC match detected; transaction blocked
    await fileSAR(userId, amount, 'OFAC sanction match on transaction');
    throw new Error('Transaction blocked');
  }

  // 4. Monitor for suspicious patterns
  const recentTransactions = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000)); // 24 hours

  const totalIn24h = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
  const velocity = recentTransactions.length;

  if (totalIn24h > 50000 || velocity > 10) {
    // File SAR: Rapid transaction pattern
    await fileSAR(userId, amount, 'Suspicious velocity pattern detected', {
      total_24h: totalIn24h,
      transaction_count: velocity,
    });
  }

  // 5. Process payment
  const transaction = await processPayment(userId, amount);

  // 6. Log to AML audit trail
  await supabase.from('aml_audit_log').insert({
    user_id: userId,
    event_type: 'transaction_processed',
    details: { transaction_id: transaction.id, amount },
  });

  return transaction;
}
```

---

## 8. Compliance Roadmap (Timeline)

### Phase 0: Current (Simulated Payments) ✅

**Status:** 🟢 COMPLIANT

- [ ] No real money accepted
- [ ] No licensing required
- [ ] No KYC required
- [ ] No AML program required

**Documentation:** Clearly state "Simulated Payments" in app + terms.

### Phase 1: Before Real Money (6-9 Months)

**When:** Before accepting first real buy-in

- [ ] **Register with FinCEN** (Form 107)
  - Cost: $0
  - Timeline: 1-2 weeks
  - Renew biennially

- [ ] **Apply for NY Money Transmission License**
  - Cost: $5,000 application + annual renewal
  - Timeline: 6-9 months review
  - Requirements: Business plan, AML program, capital, background checks

- [ ] **Implement KYC Program**
  - Collect: name, DOB, address, SSN, email, phone
  - Verify: identity service integration (Plaid, Jumio)
  - Tables: kyc_verifications

- [ ] **Implement OFAC Screening**
  - Daily screening against SDN list
  - Service: Actifi, ComplyAdvantage, or equivalent
  - Cost: ~$500-2,000/month

- [ ] **Implement AML Compliance Program**
  - Written policies & procedures
  - Transaction monitoring (SAR filing)
  - Compliance officer appointed
  - Training program established

- [ ] **Hire/Appoint Compliance Officer**
  - Responsibility: oversee AML program, file SARs, respond to exams
  - Can be contractor (~$2,000-5,000/month) or in-house

- [ ] **Establish Payment Processor Agreement**
  - DPA with Stripe/Square requiring compliance with FinCEN regulations
  - Processor must have AML controls

### Phase 2: Before Scale (12+ Months)

- [ ] **Apply for additional state licenses** (if expanding beyond NY)
  - Timeline: 6-9 months each
  - Cost: $50,000-150,000 total (all states)

- [ ] **Conduct independent AML audit**
  - Annual requirement
  - Cost: $10,000-25,000
  - Auditor: Big 4 accounting firm or specialized compliance auditor

- [ ] **Prepare for regulatory examination**
  - NY DFS conducts on-site exams every 2-3 years
  - Prepare documentation: transaction logs, KYC files, SAR forms, training records

---

## 9. Cost Impact of Licensing

### One-Time Costs

| Item | Cost | Timeline |
|------|------|----------|
| Legal (licensing application) | $10,000-25,000 | Upfront |
| FinCEN registration | $0 | Immediate |
| NY DFS application fee | $5,000 | With application |
| Software development (KYC, AML, SAR) | $30,000-50,000 | 3-6 months |
| Compliance officer onboarding | $5,000-10,000 | Ongoing setup |
| OFAC screening setup | $5,000 | Initial config |
| **Total One-Time** | **$55,000-90,000** | **3-9 months** |

### Annual Recurring Costs

| Item | Cost/Year |
|------|-----------|
| NY DFS license renewal | $500-5,000 |
| Compliance officer salary/contractor | $24,000-60,000 |
| OFAC/sanction screening | $6,000-24,000 |
| AML software/monitoring | $5,000-15,000 |
| Regulatory exam prep | $10,000-20,000 |
| Annual audit | $10,000-25,000 |
| Training & certifications | $2,000-5,000 |
| Legal (ongoing) | $5,000-15,000 |
| **Total Annual** | **$62,500-169,000** |

**Implication:** Money transmission licensing adds **$60K-170K/year** operational burden.

---

## 10. Critical Gaps (Before Real Money)

| Gap | Severity | Impact | Remediation |
|-----|----------|--------|------------|
| **No FinCEN registration** | 🔴 CRITICAL | Operating without federal registration = criminal | Register immediately before accepting real money |
| **No NY DFS license** | 🔴 CRITICAL | Illegal money transmission in NY | Begin application 6-9 months before launch |
| **No KYC implementation** | 🔴 CRITICAL | Cannot verify user identity; violates FinCEN | Implement identity verification (Plaid, Jumio) |
| **No AML program** | 🔴 CRITICAL | Cannot detect money laundering; violates FinCEN | Create policies; appoint compliance officer |
| **No OFAC screening** | 🔴 CRITICAL | Could process transactions for sanctioned individuals | Integrate screening service (Actifi) |
| **No SAR filing capability** | 🔴 CRITICAL | Cannot report suspicious activity to FinCEN | Implement FinCEN Form 111 filing |
| **No compliance officer** | 🔴 CRITICAL | No oversight of AML program | Hire/appoint dedicated compliance officer |
| **No audit trail** | 🟡 HIGH | Cannot demonstrate regulatory compliance | Add aml_audit_log table; log all KYC/AML actions |
| **No capital reserve** | 🟡 HIGH | May not meet NY DFS capital requirements | Ensure $25,000-50,000 net worth minimum |
| **No payment processor DPA** | 🟡 HIGH | Stripe/Square not committed to compliance | Negotiate DPA requiring AML controls |

---

## 11. Regulatory Contacts & Resources

### Federal (FinCEN)

| Resource | Link | Purpose |
|----------|------|---------|
| **FinCEN MSB Portal** | https://msb.fincen.gov | Register as Money Services Business |
| **FinCEN AML Guidance** | https://www.fincen.gov/financial-institutions/msbs | Compliance guidance |
| **FinCEN SAR Filing** | https://www.fincen.gov/reporting-requirements-msbs | File Suspicious Activity Reports |
| **OFAC Search Tool** | https://sanctionssearch.ofac.treas.gov | Check against sanction lists |
| **FinCEN Contact** | fincensupport@fincen.gov | Questions about compliance |

### New York (NYDFS)

| Resource | Link | Purpose |
|----------|------|---------|
| **NYDFS Money Transmitter** | https://www.dfs.ny.gov/banking/money_transmitters | License & regulations |
| **NYDFS Application** | https://www.dfs.ny.gov/banking/money_transmitters/mtl_app | Submit application |
| **NYDFS Cybersecurity Requirements** | https://www.dfs.ny.gov/industry-and-profession/banking-products-and-services/cybersecurity-requirements-financial-services-companies | 23 NYCRR 500 |
| **NYDFS Contact** | (212) 902-8900 | Questions about NY license |

---

## 12. Recommended Immediate Actions

### ⚠️ BEFORE Accepting Real Money:

1. **Consult with FinTech Legal Counsel**
   - Specialize in money transmission
   - Familiar with NY DFS requirements
   - Cost: $5,000-10,000 for initial consultation
   - Firms: Paul Hastings, Stroock, Orrick (FinTech divisions)

2. **Develop Detailed Compliance Plan**
   - KYC procedures
   - AML program
   - SAR filing process
   - OFAC screening
   - Timeline: 1-2 months to develop

3. **Set Up FinCEN & OFAC Accounts**
   - Register MSB with FinCEN (Form 107)
   - Set up OFAC screening account
   - Timeline: Immediately

4. **Implement KYC in App**
   - Identity verification integration
   - Tables: kyc_verifications, cdd_records
   - Timeline: 3-6 months development

5. **Integrate OFAC Screening**
   - Service: Actifi, ComplyAdvantage
   - Real-time screening on transactions
   - Timeline: 2-4 weeks

6. **Appoint Compliance Officer**
   - Internal or contractor
   - Responsibility: AML program oversight, SAR filing, regulatory response
   - Salary: $24,000-60,000/year

7. **File for NY DFS License**
   - Begin 6-9 months before real money launch
   - Application: 20-30 pages + supporting docs
   - Timeline: 6-9 months review

8. **Conduct Independent Audit**
   - Annual requirement post-license
   - Schedule: Before first real transaction
   - Cost: $10,000-25,000

---

## 13. Simulated vs. Real Money: Clear Messaging

**Current (Simulated):**

Add clear disclaimers in app:

```
IMPORTANT: Tournacent is currently in BETA with SIMULATED PAYMENTS.
No real money is charged or paid out. This is for testing purposes only.

When real money features launch:
- Full KYC verification required
- Full compliance with FinCEN & NYDFS regulations
- Regulatory disclosures provided before accepting buy-in
```

**In Terms of Service:**

```
2.1 Simulated Payments
During beta, all buy-in amounts and payouts are SIMULATED. 
No real funds are transferred. This changes when we notify you in writing.

2.2 Transition to Real Payments
When real payments begin, you will be required to:
- Complete identity verification (KYC)
- Agree to updated terms
- Accept regulatory disclosures
- Provide payment method for real charges
```

---

## 14. Comparison: Alternatives to Direct Money Transmission

If licensing is too burdensome, consider:

### Option A: White-Label Payment Platform

**Use:** Square Payouts, Stripe Connect, or PayPal Commerce

| Aspect | Direct | Via Platform |
|--------|--------|-------------|
| **Licensing** | You must get NY license | Platform is licensed; you're not |
| **KYC** | You must implement | Platform provides (integrated) |
| **AML** | You must implement | Platform provides |
| **SAR Filing** | You must file | Platform files (if triggered) |
| **Compliance** | Your responsibility | Shared with platform |
| **Cost** | $60K-170K/year | 2-3% + flat fee per transaction |
| **Control** | Full | Limited (platform rules) |

**Recommendation:** ✅ Consider for early stage. Stripe Connect + Stripe's compliance handles licensing.

### Option B: Tournament/Escrow Service

**Model:** User funds held in escrow by third party until challenge ends.

**Benefits:**
- Escrow agent (not you) is money transmitter
- You collect entry fee (payment processing, not transmission)
- Lower compliance burden

**Drawback:** Less control; third-party dependency

---

## 15. Summary & Decision Matrix

| Scenario | Licensing Required? | Timeline | Cost |
|----------|-------------------|----------|------|
| **Simulated payments only** | ❌ NO | — | — |
| **Real money (direct transmission)** | ✅ YES | 6-12 months | $60K-170K/year |
| **Via Stripe Connect (payment processing)** | ⚠️ Partial | Immediate | 2-3% per transaction |
| **Escrow model** | ⚠️ Partial | Immediate | Escrow agent fee |

---

**Last Updated:** 2026-04-22  
**Next Review:** When business model changes to real money

---

## Appendix: Key Terms

| Term | Definition |
|------|-----------|
| **Money Transmitter** | Entity accepting money from one person and sending to another |
| **KYC** | Know Your Customer; identity verification |
| **AML** | Anti-Money Laundering; program to detect suspicious activity |
| **CIP** | Customer Identification Program; baseline KYC |
| **CDD** | Customer Due Diligence; enhanced KYC for high-risk transactions |
| **SAR** | Suspicious Activity Report; filed with FinCEN |
| **OFAC** | Office of Foreign Assets Control; sanction list screening |
| **FinCEN** | Financial Crimes Enforcement Network (US Treasury) |
| **NYDFS** | New York Department of Financial Services |
| **BitLicense** | NY virtual currency license (not applicable to Tournacent) |
| **Net Worth** | Capital requirement for money transmitter license |
| **Compliance Officer** | Person responsible for AML program |
| **PEP** | Politically Exposed Person; higher-risk customer |
| **CTR** | Currency Transaction Report (>$10K cash transactions) |
