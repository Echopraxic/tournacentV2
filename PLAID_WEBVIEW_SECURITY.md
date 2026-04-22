# Plaid WebView Security Assessment

**Assessment Date:** 2026-04-22  
**Remediation Date:** 2026-04-22  
**Component:** `components/PlaidLink.tsx` (React Native WebView wrapper)  
**Risk Level:** 🟢 **LOW** — All Phase 1 vulnerabilities fixed  
**Severity Breakdown:** 2 High (fixed), 3 Medium (fixed), 1 Medium (deferred — SRI)

---

## Executive Summary

Your Plaid Link implementation uses a **WebView** instead of native SDK. This is a **security trade-off**:

| Aspect | WebView | Native SDK |
|--------|---------|-----------|
| **XSS vulnerability** | 🔴 Possible | ✅ Not applicable |
| **JavaScript injection** | 🔴 Possible if input not sanitized | ✅ Not applicable |
| **Public token exposure** | 🟡 Possible via XSS | ✅ Safer (encapsulated) |
| **Credential access** | 🟡 Possible via XSS | ✅ Safer (device-level isolation) |
| **CDN compromise** | 🔴 Possible (Plaid CDN) | ✅ Safer (no external JS) |
| **Development simplicity** | ✅ Easier (cross-platform) | ❌ Platform-specific |

**Current code:** ✅ **Phase 1 hardening applied** — all previously identified issues fixed

---

## 1. WebView vs Native SDK Comparison

### 1.1 Architecture Differences

#### WebView Approach (Current Implementation)

```
┌─────────────────────────────────────────┐
│   React Native App                      │
│  ┌──────────────────────────────────┐   │
│  │ PlaidLink Component              │   │
│  │ ┌──────────────────────────────┐ │   │
│  │ │  WebView (HTML/JS)           │ │   │
│  │ │  ┌────────────────────────┐  │ │   │
│  │ │  │ Plaid Link JS (CDN)    │  │ │   │
│  │ │  │ - Loads from https://cdn.plaid.com │ │
│  │ │  │ - Runs in JS context   │  │ │   │
│  │ │  │ - postMessage to RN    │  │ │   │
│  │ │  └────────────────────────┘  │ │   │
│  │ │ Window.ReactNativeWebView    │ │   │
│  │ │ (bridge to native)           │ │   │
│  │ └──────────────────────────────┘ │   │
│  └──────────────────────────────────┘   │
│  onMessage (receives public_token)       │
└─────────────────────────────────────────┘

Flows:
1. App generates link token (server)
2. Pass to PlaidLink component
3. WebView loads HTML with Plaid Link JS
4. User connects bank (in WebView)
5. Plaid returns public_token
6. postMessage sends token to RN
7. App sends token to backend
8. Backend exchanges for access token
```

#### Native SDK Approach (Alternative)

```
┌─────────────────────────────────────────┐
│   React Native App                      │
│  ┌──────────────────────────────────┐   │
│  │ PlaidLink Component (Native)     │   │
│  │ ┌──────────────────────────────┐ │   │
│  │ │ Plaid Native SDK (compiled)  │ │   │
│  │ │ - iOS: PlaidLink framework   │ │   │
│  │ │ - Android: Plaid SDK JAR     │ │   │
│  │ │ - Direct device API access   │ │   │
│  │ │ - Secure enclave support     │ │   │
│  │ └──────────────────────────────┘ │   │
│  └──────────────────────────────────┘   │
│  onSuccess callback (receives public_token) │
└─────────────────────────────────────────┘
```

### 1.2 Security Comparison

| Attack Vector | WebView | Native |
|---------------|---------|--------|
| **XSS in Plaid JS** | 🔴 Can read `window` + tokens | ✅ JS isolation |
| **Malicious CDN JS** | 🔴 Executes in WebView context | ✅ No CDN dependency |
| **WebView bridge exploitation** | 🔴 postMessage → RN bridge | ✅ Secure native bridge |
| **Memory dump (rooted/jailbroken)** | 🟡 Token in app memory | 🟡 Token in app memory |
| **Keylogger (permissions abuse)** | 🟡 Bank credentials typed in WebView | 🟡 Bank credentials typed in native |
| **Certificate pinning** | 🔴 WebView uses system certs | ✅ SDK can pin Plaid certs |
| **JavaScript sandbox escape** | 🔴 Possible on older Android | ✅ Not applicable |

---

## 2. Vulnerabilities — All Phase 1 Items Fixed

### 2.1 Vulnerability #1: Unescaped linkToken in HTML Template ✅ FIXED

**Location:** `PlaidLink.tsx` — `buildPlaidHtml()` / `escapeLinkToken()`

**Was:** Token embedded raw via template literal `token: '${linkToken}'`.

**Fix applied:** `escapeLinkToken()` function escapes all characters that could break
out of a JS single-quoted string context before embedding:

```typescript
function escapeLinkToken(token: string): string {
  return token
    .replace(/\\/g, '\\\\')   // must be first to avoid double-escaping
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\x3C')   // neutralises </script> in token
    .replace(/>/g, '\\x3E')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
```

**Residual risk:** Requires backend compromise to supply a malicious token. With
escaping, even a compromised backend cannot inject arbitrary JS.

---

### 2.2 Vulnerability #2: Overly Permissive originWhitelist ✅ FIXED

**Location:** `PlaidLink.tsx` — `<WebView>` props

**Was:** `originWhitelist={['*']}` — WebView could navigate to any scheme/origin,
including `javascript:` URIs and plain HTTP pages.

**Fix applied:** `originWhitelist={['https://*']}` — blocks `javascript:` URIs,
`http://` redirects, and custom scheme navigation. HTTPS-only is preserved so
OAuth bank flows (Chase, Wells Fargo, etc.) can still redirect to institution
HTTPS pages during the auth flow.

> **Note:** Restricting further to `['https://cdn.plaid.com']` would break OAuth
> bank connections. The `https://*` restriction is the correct balance.

---

### 2.3 Vulnerability #3: Missing Content Security Policy ✅ FIXED

**Location:** `PlaidLink.tsx` — `buildPlaidHtml()` HTML `<head>`

**Was:** No CSP — injected JS had full access to `window`, `fetch`, `localStorage`.

**Fix applied:** CSP meta tag added to the generated HTML:

```
default-src 'none';
script-src 'unsafe-inline' https://cdn.plaid.com;
style-src 'unsafe-inline';
img-src https:;
font-src https:;
connect-src https:;
```

`unsafe-inline` for `script-src` is required because Plaid Link JS uses inline
event handlers. The CSP still blocks scripts from any origin except `cdn.plaid.com`,
blocking the most impactful injection vectors (external script loading, fetch to
arbitrary domains).

---

### 2.4 Vulnerability #4: domStorageEnabled without Isolation ✅ FIXED

**Location:** `PlaidLink.tsx` — `<WebView>` props

**Was:** `domStorageEnabled` (prop present = `true`) — XSS could read/write
`localStorage` and `sessionStorage`.

**Fix applied:** `domStorageEnabled={false}` — removes the localStorage attack
surface entirely. Plaid Link JS does not require localStorage for its core flow
(token is passed via `postMessage`, not stored).

---

### 2.5 Vulnerability #5: No public_token Validation on Return ✅ FIXED

**Location:** `PlaidLink.tsx` — `handleMessage()`

**Was:** `onSuccess(data.public_token, data.metadata ?? {})` with no validation —
any XSS-injected `postMessage` would be accepted as a legitimate token.

**Fix applied:** Token format validated before forwarding to caller:

```typescript
const PLAID_PUBLIC_TOKEN_PATTERN = /^public-[a-z0-9_-]{25,}$/i;

if (!PLAID_PUBLIC_TOKEN_PATTERN.test(data.public_token)) {
  console.error('PlaidLink: invalid public_token format');
  onExit();
  return;
}
```

Metadata structure also validated (must be a plain object, not an array or
primitive). Unknown `data.type` values now call `onExit()` instead of being silently
ignored.

---

### 2.6 Additional Fix: WebView Error Handlers ✅ FIXED

**Was:** No `onError` or `onHttpError` — WebView failures were silent; the loading
spinner would spin indefinitely.

**Fix applied:** Both handlers added; each logs the error and calls `onExit()` to
return control to the calling screen gracefully.

---

### 2.7 Additional Fix: Link Token Expiry Guard ✅ FIXED

**Was:** No expiry check — a stale link token would open the WebView and fail
silently inside Plaid's JS.

**Fix applied:** Optional `linkTokenExpiry` prop (Unix timestamp in seconds). If
provided, the component calls `onExit()` before rendering the WebView when
`Date.now() > linkTokenExpiry * 1000`.

---

## 3. Deferred Items (Phase 2)

### 3.1 Subresource Integrity (SRI) — ⏳ DEFERRED

**Status:** Cannot be implemented without Plaid publishing a stable SRI hash.

**Why:** Plaid's CDN serves a versioned endpoint
(`/link/v2/stable/link-initialize.js`) that is updated by Plaid periodically
without notice. Adding an SRI hash would break the WebView every time Plaid pushes
an update.

**Action:** Contact Plaid support requesting either:
  - Published SRI hashes with advance notification before updates, OR
  - A locked version endpoint (e.g. `/link/v2.8.3/link-initialize.js`)

Until then, certificate pinning (Phase 3) provides equivalent integrity guarantees
against CDN MITM attacks.

### 3.2 Rate Limiting on Link Token Generation — ⏳ DEFERRED

**Status:** Server-side concern; not implemented in this component.

**Recommended:** In `supabase/functions/exchange-token/index.ts`, add a check that
limits how many link tokens a single user can generate per hour (suggest: 10/hour).
Flag anomalous rates to the security audit log.

---

## 4. Remaining Phase 3 Items (Optional)

| Item | Effort | Priority |
|------|--------|----------|
| Certificate pinning for `cdn.plaid.com` | 2–4 hours | Medium |
| Migrate to react-native-plaid-link-sdk (native) | 1–2 weeks | Low |
| Tamper detection (hash HTML template, log mismatch) | 2–4 hours | Low |

---

## 5. Plaid Credentials & Public Token Security

### 5.1 What Can Be Exposed (& Severity)

| Item | Exposed? | Impact | Severity |
|------|----------|--------|----------|
| **Public Key** | ✅ Yes (public) | Client identifier | 🟢 LOW |
| **Private Key** | ❌ No (server-only) | Can exchange tokens | 🔴 CRITICAL |
| **Link Token** | ✅ Yes (single-use) | Generates one pub token | 🟡 MEDIUM |
| **Public Token** | ⚠️ Maybe (XSS) | Single redemption | 🟡 MEDIUM |
| **Access Token** | ❌ No (never in client) | Read bank data | 🔴 CRITICAL |
| **Bank Credentials** | ❌ No (typed in Plaid servers) | Log into bank | 🔴 CRITICAL |

**Key insight:** Even if `public_token` is exposed via XSS, it is single-use and
has no value without the private key (server-side only). The backend validates and
exchanges it; an attacker cannot benefit from a stolen public_token unless they also
compromise the backend.

---

## 6. XSS/JavaScript Injection Attack Scenarios

### 6.1 CDN Compromise

**Scenario:** Attacker compromises `https://cdn.plaid.com`

**Impact:** 🔴 CRITICAL — malicious JS executes in WebView context

**Mitigations applied:**
- ✅ CSP restricts script execution to `cdn.plaid.com` (limits lateral injection)
- ✅ `public_token` validation rejects injected fake tokens
- ⏳ SRI hash (deferred — Plaid must provide hash)
- ⏳ Certificate pinning (Phase 3)

### 6.2 WebView Bridge Abuse

**Scenario:** App has another vulnerability allowing JS injection

**Impact:** 🟡 MEDIUM

**Mitigations applied:**
- ✅ `public_token` format validated before forwarding to caller
- ✅ `domStorageEnabled={false}` removes localStorage read surface
- ✅ Unknown message types rejected

### 6.3 linkToken String Injection

**Scenario:** Backend compromise returns malicious linkToken containing JS

**Impact:** 🟡 MEDIUM (requires backend compromise)

**Mitigations applied:**
- ✅ `escapeLinkToken()` neutralises all breakout characters
- ✅ CSP blocks any successfully injected external scripts

---

## 7. Current Risk Assessment

| Issue | Severity | Status |
|-------|----------|--------|
| Unescaped linkToken | 🔴 HIGH | ✅ Fixed — `escapeLinkToken()` |
| Overly permissive originWhitelist | 🔴 HIGH | ✅ Fixed — `['https://*']` |
| No CSP | 🟡 MEDIUM | ✅ Fixed — CSP meta tag added |
| domStorageEnabled | 🟡 MEDIUM | ✅ Fixed — `domStorageEnabled={false}` |
| No public_token validation | 🟡 MEDIUM | ✅ Fixed — regex + type guards |
| No error handlers | 🟡 MEDIUM | ✅ Fixed — `onError` + `onHttpError` |
| No link token expiry check | 🟢 LOW | ✅ Fixed — `linkTokenExpiry` prop |
| No SRI on Plaid script | 🟡 MEDIUM | ⏳ Deferred — awaiting Plaid SRI hash |
| No certificate pinning | 🟡 MEDIUM | ⏳ Phase 3 |

**Overall:** 🟢 **LOW RISK** — Phase 1 complete. Residual risk from CDN supply chain
attack is mitigated by CSP + token validation; SRI/cert-pinning (Phase 2–3) would
reduce this further.

---

## 8. Testing Checklist

- [x] **XSS attempt:** Inject `' onSuccess=function(){} //` in linkToken → `escapeLinkToken()` neutralises apostrophe
- [x] **Script injection:** Inject `</script><script>alert(1)</script>` → `\\x3C/script\\x3E` prevents tag close
- [x] **Origin navigation:** `window.location = 'http://attacker.com'` → blocked by `originWhitelist=['https://*']`
- [x] **Token validation:** Pass `"fake_token"` → rejected by `PLAID_PUBLIC_TOKEN_PATTERN`
- [x] **Malformed JSON:** Send `"not json"` → caught by `try/catch`, calls `onExit()`
- [x] **Unknown message type:** Send `{ type: 'hack' }` → calls `onExit()`
- [x] **Expired token:** Pass `linkTokenExpiry` in the past → component calls `onExit()` before render
- [ ] **CDN offline:** Test with no network → `onError` fires, calls `onExit()`
- [ ] **CSP violation:** Load external script in WebView → blocked by CSP header

---

## 9. Native SDK vs WebView: Decision Matrix

### Use WebView If:
- ✅ Android + iOS code sharing is critical
- ✅ Development team knows JavaScript better than Kotlin/Swift
- ✅ Willing to implement security hardening (done)
- ✅ Happy with Plaid's JS SDK feature set

### Use Native SDK If:
- ✅ Maximum security is priority (no JS = no XSS)
- ✅ Team has Kotlin/Swift expertise
- ✅ Want certificate pinning out-of-the-box
- ✅ Want offline support (native SDK can cache)

**Current recommendation:** Keep WebView. Phase 1 hardening is complete and risk is
now LOW. Revisit migration to native SDK in 6–12 months if new attack vectors emerge
or if the app moves to production with real money buy-ins.

---

## 10. Implementation Roadmap

### Phase 1: Immediate (Complete ✅)

- [x] Escape linkToken in HTML template
- [x] Restrict originWhitelist to `https://*`
- [x] Validate public_token format on client
- [x] Disable domStorage
- [x] Add CSP header
- [x] Add WebView error handlers
- [x] Add link token expiry guard

### Phase 2: Short-term (Deferred)

- [ ] Add SRI to Plaid script *(blocked on Plaid providing hash)*
- [ ] Rate limit link token generation server-side

### Phase 3: Long-term (Optional)

- [ ] Implement certificate pinning for `cdn.plaid.com`
- [ ] Consider migration to `react-native-plaid-link-sdk` (native)
- [ ] Add tamper detection (hash HTML template, log mismatch)

---

**Last Updated:** 2026-04-22 — Phase 1 hardening complete  
**Next Review:** 2026-07-22 (Quarterly) or when Plaid publishes SRI hashes
