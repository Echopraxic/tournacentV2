# Deep Link Security: Verified App Links & Invite Code Integrity

**Assessment Date:** 2026-04-22  
**Current Implementation:** Custom URL scheme `tournacent://`  
**Risk Level:** 🔴 **HIGH** — Unverified scheme vulnerable to hijacking  
**Remediation:** Implement Android App Links + iOS Universal Links + code validation

---

## 1. Executive Summary

**Current state:** Tournacent uses custom URL scheme `tournacent://join/TC-XXXX`

**Risk:** Any app on the device can register the same scheme and intercept invites

**Impact:** Attacker steals invite codes → joins challenges → gains access to financial data/prize pool

**Solution:** Verified app links (Android App Links + iOS Universal Links) + invite code validation

**Implementation effort:** 2-4 weeks (build setup, certificate/domain setup, validation code)

---

## 2. Deep Link Attack Vectors

### 2.1 Android: Custom Scheme Hijacking

**Vulnerability:** Android allows multiple apps to register the same custom scheme.

**Attack scenario:**

1. Victim receives invite: `tournacent://join/TC-A3KP`
2. Victim taps link
3. Android shows **intent chooser**: "Open with: Tournacent or TournaCent (Fake)"
4. If victim clicks fake app by mistake → app gets invite code
5. Attacker submits code to join group → accesses financial data

**Why it works:**
- Custom schemes (`tournacent://`) are not verified
- Android doesn't check app ownership
- Multiple apps can declare the same scheme in `AndroidManifest.xml`

### 2.2 iOS: Custom Scheme Hijacking

**Similar risk on iOS:**

```xml
<!-- TournaCent (malicious app) can declare same scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>tournacent</string>
    </array>
  </dict>
</array>
```

**iOS behavior:**
- If multiple apps declare same scheme, iOS returns to most recently launched app
- Attacker can prompt user to open their app, then wait for invite link
- Link goes to attacker's app instead of Tournacent

### 2.3 Invite Code as Cryptographic Token

**Additional risk:** Invite code `TC-A3KP` is a **cryptographic token**.

**Vulnerabilities:**
- Transmitted in plain-text URL
- No integrity check (HMAC/signature)
- No expiration
- Brute-forceable if space is small (4 chars = ~2.8M combinations)

---

## 3. Android: App Links (Verified) Solution

### 3.1 Android App Links vs. Custom Schemes

| Aspect | Custom Scheme | App Links |
|--------|---------------|-----------|
| **Verification** | ❌ None | ✅ Digital Asset Links |
| **Ambiguity** | 🔴 Multiple apps possible | ✅ One verified owner |
| **Intent Chooser** | ❌ Shows all apps | ✅ Opens directly |
| **Domain Ownership** | ❌ Not checked | ✅ Requires HTTPS cert |
| **Hijacking Risk** | 🔴 HIGH | ✅ LOW |

### 3.2 Android App Links Implementation

**Step 1: Add App Links to AndroidManifest.xml**

```xml
<!-- app/build.gradle or AndroidManifest.xml -->
<activity
  android:name=".JoinChallengeActivity"
  android:exported="true">
  
  <!-- Custom scheme (fallback) -->
  <intent-filter android:autoVerify="false">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:scheme="tournacent"
      android:host="join"
      android:pathPattern="/.*" />
  </intent-filter>

  <!-- App Link (verified) -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:scheme="https"
      android:host="tournacent.com"
      android:pathPattern="/join/.*" />
  </intent-filter>
</activity>
```

**Step 2: Create Digital Asset Links File**

Host at: `https://tournacent.com/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tournacent.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

**Get your signing certificate fingerprint:**

```bash
# Find your app's signing keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Production keystore
keytool -list -v -keystore /path/to/release.keystore -alias release -storepass [password] -keypass [password]
```

**Step 3: Verify Digital Asset Links**

Test that Android can verify your app:

```bash
# Test Digital Asset Links verification
adb shell am start -a android.intent.action.VIEW \
  -d "https://tournacent.com/join/TC-A3KP" \
  com.tournacent.app

# Check logcat for verification results
adb logcat | grep -i "app links verification"
```

**Expected output:**
```
UrlHandler: Verification succeeded
App links state: verified
```

### 3.3 Fallback Behavior

**Important:** Always include custom scheme fallback.

**Why:** Digital Asset Links verification takes time (24-48 hours). During development:
- App Links won't verify immediately
- Custom scheme fallback ensures app still works
- Users still see intent chooser, but app link is preferred

---

## 4. iOS: Universal Links (Verified) Solution

### 4.1 iOS Universal Links vs. Custom Schemes

| Aspect | Custom Scheme | Universal Links |
|--------|---------------|-----------------|
| **Verification** | ❌ None | ✅ HTTPS + apple-app-site-association |
| **Intent Chooser** | ✅ Can skip | ✅ Opens directly (no prompt) |
| **Domain Ownership** | ❌ Not checked | ✅ Requires HTTPS cert |
| **Fallback** | N/A | ✅ Falls back to web if no app |

### 4.2 iOS Universal Links Implementation

**Step 1: Add Universal Links to Info.plist**

```xml
<!-- ios/Tournacent/Info.plist -->
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:tournacent.com</string>
  <string>webcredentials:tournacent.com</string>
</array>
```

**Step 2: Create apple-app-site-association File**

Host at: `https://tournacent.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.tournacent.app",
        "paths": ["/join/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.com.tournacent.app"]
  }
}
```

**Get your Team ID & Bundle ID:**
- Team ID: Apple Developer Account → Membership
- Bundle ID: Xcode → Project → Build Settings → `PRODUCT_BUNDLE_IDENTIFIER`

**Example:**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABC123XYZ.com.tournacent.app",
        "paths": ["/join/*"]
      }
    ]
  }
}
```

**Step 3: Verify Universal Links**

```bash
# Test Universal Links verification (from Mac)
swcutil -d tournacent.com

# Expected output:
# domain: tournacent.com
# status: ✓ Signed & Valid
# ...
# appID: ABC123XYZ.com.tournacent.app
# path: /join/*
```

---

## 5. Invite Code Validation & Integrity

### 5.1 Current Invite Code Format

**Format:** `TC-XXXX` where X ∈ `{A-Z, 2-9}` (32 characters, 0/O/1/I/L removed)

**Space:** 32^4 = ~1M combinations (too small for security)

**Issues:**
1. ❌ No signature/HMAC
2. ❌ Brute-forceable
3. ❌ No expiration timestamp
4. ❌ No rate limiting on lookup

### 5.2 Recommended: Code Signature (HMAC)

**New format:** `TC-XXXX-YYYY` where YYYY is HMAC signature

```typescript
// Generate invite code with HMAC
import crypto from 'crypto';

const HMAC_SECRET = process.env.INVITE_HMAC_SECRET; // Keep in Supabase secrets

function generateInviteCode(challengeId: string): string {
  // Generate random 4-char code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TC-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  // Generate HMAC signature
  const hmac = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${code}:${challengeId}`)
    .digest('hex')
    .slice(0, 4) // Take first 4 chars
    .toUpperCase();

  return `${code}-${hmac}`;
}

// Validate code
function validateInviteCode(fullCode: string, challengeId: string): boolean {
  const [code, signature] = fullCode.split('-');

  // Regenerate expected HMAC
  const expectedHmac = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${code}:${challengeId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();

  // Constant-time comparison (prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedHmac)
  );
}
```

**Result:**
- ✅ Prevents code forgery (attacker can't predict HMAC)
- ✅ Binding to challenge_id (code only works for intended challenge)
- ✅ Constant-time comparison (prevents timing attacks)

### 5.3 Expiration & Rate Limiting

**Add expiration to invite codes:**

```sql
CREATE TABLE invites (
  id uuid PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '48 hours',
  used_count integer DEFAULT 0,
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  used_at timestamptz
);
```

**Lookup with validation:**

```typescript
// supabase/functions/join-via-invite/index.ts
async function joinChallengeViaInvite(userId: string, inviteCode: string) {
  // 1. Look up invite
  const { data: invite, error } = await supabase
    .from('invites')
    .select('challenge_id, expires_at, used_count, max_uses')
    .eq('code', inviteCode)
    .single();

  if (!invite) {
    return { error: 'Invalid invite code' }; // 404
  }

  // 2. Check expiration
  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'Invite code has expired' };
  }

  // 3. Check max uses
  if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
    return { error: 'Invite code has been used too many times' };
  }

  // 4. Verify HMAC signature
  const [code, signature] = inviteCode.split('-');
  const isValid = validateInviteCode(inviteCode, invite.challenge_id);
  if (!isValid) {
    return { error: 'Invalid invite code signature' };
  }

  // 5. Proceed with join
  const { error: joinError } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: invite.challenge_id,
      user_id: userId,
    });

  if (!joinError) {
    // 6. Increment used_count
    await supabase
      .from('invites')
      .update({ used_count: invite.used_count + 1, used_at: new Date() })
      .eq('code', inviteCode);
  }

  return { joinError };
}
```

### 5.4 Rate Limiting on Invite Lookup

**Prevent brute force attempts:**

```typescript
// supabase/functions/join-via-invite/index.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const RATE_LIMIT = 5; // attempts
const RATE_WINDOW = 60; // seconds

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `invite_lookup:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, RATE_WINDOW);
  }

  return count <= RATE_LIMIT;
}

export async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { inviteCode, userId } = await req.json();

  // Rate limit
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return new Response('Too many attempts', { status: 429 });
  }

  // Proceed with lookup...
}
```

---

## 6. URL Integrity in Transit

### 6.1 HTTPS Enforcement

**Current setup:** Links sent in emails, SMS, app shares

**Risk:** If link sent over HTTP or unencrypted channel, it can be intercepted

**Solution:** Always use HTTPS + force app link preference

```
Instead of: http://tournacent.com/join/TC-A3KP ❌
Use:        https://tournacent.com/join/TC-A3KP ✅
Fallback:   tournacent://join/TC-A3KP (custom scheme)
```

### 6.2 URL Parameter Validation

**Validate invite code format before routing:**

```typescript
// app/join/[code].tsx
import { useRoute } from '@react-navigation/native';

export default function JoinChallengeScreen() {
  const route = useRoute();
  const { code } = route.params;

  // Validate format: TC-XXXX or TC-XXXX-YYYY
  const INVITE_PATTERN = /^TC-[A-Z2-9]{4}(?:-[A-Z0-9]{4})?$/;
  
  if (!INVITE_PATTERN.test(code)) {
    return <ErrorScreen message="Invalid invite code format" />;
  }

  // Proceed with lookup...
  useEffect(() => {
    joinChallenge(code);
  }, [code]);
}
```

### 6.3 Share Link Construction

**When generating share links, use HTTPS + app link:**

```typescript
function generateShareLink(inviteCode: string): string {
  // Primary: HTTPS universal/app link
  // Fallback: Custom scheme
  const link = `https://tournacent.com/join/${inviteCode}`;
  
  return link;
}

function shareChallenge(challenge: Challenge) {
  const link = generateShareLink(challenge.invite_code);
  
  Share.share({
    message: `Join my challenge: ${challenge.name}\n\n${link}`,
    url: link, // iOS will prefer this
    title: 'Join Challenge',
  });
}
```

---

## 7. Implementation Roadmap

### Phase 1: Immediate (1-2 weeks)

**Android App Links:**
- [ ] Update `AndroidManifest.xml` with App Links declaration
- [ ] Create `assetlinks.json` at `/.well-known/assetlinks.json`
- [ ] Get signing certificate SHA-256 fingerprint
- [ ] Deploy assetlinks.json to production
- [ ] Test with `adb shell am start`

**iOS Universal Links:**
- [ ] Add `com.apple.developer.associated-domains` to `Info.plist`
- [ ] Create `apple-app-site-association` at `/.well-known/`
- [ ] Deploy to production (no AASA file = universal links don't work)
- [ ] Verify with `swcutil -d tournacent.com`

### Phase 2: Code Validation (1 week)

**Invite Code Security:**
- [ ] Add HMAC signature to invite code generation
- [ ] Implement `validateInviteCode()` function
- [ ] Create `invites` table with expiration + max_uses
- [ ] Add rate limiting to invite lookup endpoint
- [ ] Update `app/join/[code].tsx` to validate format + signature

### Phase 3: Testing (1 week)

- [ ] Test Android App Links with unverified app
- [ ] Test iOS Universal Links on device
- [ ] Test fallback to custom scheme during development
- [ ] Load test invite lookup endpoint (rate limiting)
- [ ] Brute force test (verify rate limiting works)

---

## 8. Security Checklist

Before going to production:

- [ ] **Digital Asset Links verified** — `adb logcat | grep "verification"`
- [ ] **Apple App Site Association verified** — `swcutil -d tournacent.com`
- [ ] **Invite codes have HMAC signature** — Can't forge codes
- [ ] **Invite codes expire** — 48-hour TTL default
- [ ] **Rate limiting on invite lookup** — 5 attempts/60 seconds per IP
- [ ] **HTTPS enforced** — All links use `https://`, not `http://`
- [ ] **Custom scheme as fallback only** — App links are primary
- [ ] **URL parameter validation** — Format checked before routing
- [ ] **No sensitive data in URL** — Only invite code (public)
- [ ] **Test on real devices** — Simulator doesn't test verification

---

## 9. Current Code Review: app/join/[code].tsx

**Current implementation (lines 29-49):**

```typescript
const { code } = useLocalSearchParams<{ code: string }>();
// ...
const lookupChallenge = async () => {
  try {
    const { data, error } = await supabase.rpc('get_challenge_by_invite_code', { code });
    if (error || !data?.length) {
      setError('This invite link is invalid or the challenge has expired.');
      return;
    }
    // ...
  }
};
```

**Current state:** ⚠️ **Vulnerable** — No client-side or server-side validation

**Gaps:**
1. ❌ No format validation (regex check)
2. ❌ No code signature/HMAC verification
3. ❌ Unknown if RPC enforces expiration
4. ❌ Unknown if rate limiting exists on RPC

**Required improvements:**

```typescript
// app/join/[code].tsx — ADD THESE

const INVITE_CODE_PATTERN = /^TC-[A-Z2-9]{4}(?:-[A-Z0-9]{4})?$/;

const lookupChallenge = async () => {
  try {
    // 1. Validate format FIRST (before RPC call)
    if (!code || !INVITE_CODE_PATTERN.test(code)) {
      setError('Invalid invite code format.');
      return;
    }

    // 2. Call RPC (which should also validate + check expiration + rate limit)
    const { data, error } = await supabase.rpc('get_challenge_by_invite_code', { code });
    
    if (error || !data?.length) {
      // RPC returns 429 if rate limited
      if (error?.code === '429') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('This invite link is invalid or the challenge has expired.');
      }
      return;
    }

    const c = data[0] as ChallengePreview;
    setChallenge(c);
    
    // ... rest of code
  } catch {
    setError('Something went wrong. Please try again.');
  }
};
```

**Server-side (RPC function):**

Must also implement:
- HMAC signature validation
- Expiration check
- Rate limiting (in middleware or function)
- Logging of attempts for abuse detection

---

## 10. Attack Scenarios & Mitigations

| Attack | Before (Custom Scheme) | After (App Links + HMAC) |
|--------|------------------------|--------------------------|
| **App hijacking** | 🔴 Possible: Fake app intercepts invite | ✅ Blocked: Only verified app opens |
| **Code forgery** | 🔴 Possible: Attacker generates codes | ✅ Blocked: HMAC prevents forgery |
| **Brute force** | 🔴 Possible: Try all 1M codes | ✅ Blocked: Rate limiting + HMAC |
| **Invite reuse** | 🔴 Possible: Code usable unlimited times | ✅ Blocked: max_uses limit |
| **Expired codes** | 🔴 Possible: Old codes still work | ✅ Blocked: 48-hour expiration |
| **MITM in transit** | 🟡 Possible if HTTP used | ✅ Blocked: HTTPS + app link |

---

## 11. Testing: Manual Verification

### Android App Links Test

```bash
# Test: Does Android open link directly (no intent chooser)?
adb shell am start -a android.intent.action.VIEW \
  -d "https://tournacent.com/join/TC-A3KP" \
  com.tournacent.app

# Check: Did app open without chooser?
# Result: ✅ App should open directly
```

### iOS Universal Links Test

```bash
# On iOS device, long-press link in email/Messages
# Does it show "Open in App" option?
# Tap it — does it open app directly?
# Result: ✅ App should open without choosing
```

### Invite Code Validation Test

```bash
# Test 1: Malformed code
POST /join-via-invite
{ "code": "INVALID" }
→ Response: 400 Bad Request (invalid format)

# Test 2: Expired code
POST /join-via-invite
{ "code": "TC-OLD1-HMAC" } // generated 72 hours ago
→ Response: 410 Gone (expired)

# Test 3: Forged HMAC
POST /join-via-invite
{ "code": "TC-A3KP-XXXX" } // wrong HMAC
→ Response: 401 Unauthorized (invalid signature)

# Test 4: Rate limiting
for i in {1..10}; do
  curl -X POST /join-via-invite \
    -H "X-Forwarded-For: 192.0.2.1" \
    -d '{"code": "TC-XXXX-XXXX"}'
done
→ Response 1-5: Success or error
→ Response 6-10: 429 Too Many Requests
```

---

## 12. Configuration File Examples

### assetlinks.json (Android)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tournacent.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

**Host at:** `https://tournacent.com/.well-known/assetlinks.json`

### apple-app-site-association (iOS)

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABC123XYZ.com.tournacent.app",
        "paths": ["/join/*"]
      }
    ]
  }
}
```

**Host at:** `https://tournacent.com/.well-known/apple-app-site-association`

---

## 13. Cost & Timeline

| Task | Effort | Timeline |
|------|--------|----------|
| Android App Links setup | 4-6 hours | 1 week |
| iOS Universal Links setup | 4-6 hours | 1 week |
| HMAC code signing | 4-8 hours | 1 week |
| Rate limiting + expiration | 4-6 hours | 1 week |
| Testing + verification | 6-8 hours | 1 week |
| **TOTAL** | **22-34 hours** | **4-5 weeks** |

---

**Last Updated:** 2026-04-22  
**Status:** 🔴 **CRITICAL** — Implement before production
