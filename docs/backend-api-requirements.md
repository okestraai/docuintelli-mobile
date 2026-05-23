# Backend API Requirements for DocuIntelli Mobile

This document covers **all new backend endpoints** required for the mobile app to pass App Store / Play Store review and function correctly with native in-app purchases. These endpoints do not exist yet and must be built.

---

## Table of Contents

1. [POST /api/subscription/sync-iap](#1-post-apisubscriptionsync-iap) — IAP purchase sync (CRITICAL)
2. [POST /api/revenuecat/webhook](#2-post-apirevenuecatwebhook) — RevenueCat server webhook (CRITICAL)
3. [GET /api/account/export](#3-get-apiaccountexport) — GDPR data export
4. [Static Files: Universal Links](#4-static-files-universal-links) — apple-app-site-association + assetlinks.json

---

## 1. POST /api/subscription/sync-iap

### Priority: CRITICAL — Without this, purchases succeed in the App Store but the backend still shows "Free"

### When it's called

The mobile app calls this endpoint:
- Immediately after a successful native IAP purchase (free -> starter, free -> pro)
- Immediately after a native IAP upgrade (starter -> pro)
- After "Restore Purchases" is tapped
- When RevenueCat fires a `customerInfoUpdated` event in the app (real-time push)

### Authentication

Standard bearer token — same middleware as all authenticated endpoints.

```
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
X-Device-ID: <uuid>
```

### Request Body

```json
{
  "plan": "pro",
  "billing_cycle": "yearly",
  "entitlement_id": "docuintelli_pro",
  "expires_at": "2027-05-22T00:00:00.000Z"
}
```

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `plan` | string | Yes | `"free"`, `"starter"`, `"pro"` | Active plan from RevenueCat entitlements |
| `billing_cycle` | string | Yes | `"monthly"`, `"yearly"` | Derived from product ID (contains `yearly` or `monthly`) |
| `entitlement_id` | string | Yes | `"docuintelli_starter"`, `"docuintelli_pro"`, `""` | RevenueCat entitlement identifier |
| `expires_at` | string or null | Yes | ISO 8601 datetime | End of current billing period. `null` for free plan |

### Response

**Success (200):**
```json
{
  "success": true
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Invalid plan"
}
```

**Auth Error (401):**
```json
{
  "error": "Not authenticated"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

### Implementation

```javascript
const PLAN_LIMITS = {
  free:    { document_limit: 3,   monthly_upload_limit: 3,   tokens_limit: 50000,   bank_account_limit: 0 },
  starter: { document_limit: 25,  monthly_upload_limit: 30,  tokens_limit: 500000,  bank_account_limit: 1 },
  pro:     { document_limit: 100, monthly_upload_limit: 150, tokens_limit: 2000000,  bank_account_limit: 5 },
};

router.post('/subscription/sync-iap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, billing_cycle, entitlement_id, expires_at } = req.body;

    // Validate
    if (!['free', 'starter', 'pro'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({ success: false, error: 'Invalid billing cycle' });
    }

    const limits = PLAN_LIMITS[plan];
    const status = plan === 'free' ? 'canceled' : 'active';

    await db.query(`
      INSERT INTO subscriptions (
        user_id, plan, status, billing_cycle, current_period_end,
        document_limit, monthly_upload_limit, tokens_limit, bank_account_limit,
        iap_entitlement_id, iap_source, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        billing_cycle = EXCLUDED.billing_cycle,
        current_period_end = EXCLUDED.current_period_end,
        document_limit = EXCLUDED.document_limit,
        monthly_upload_limit = EXCLUDED.monthly_upload_limit,
        tokens_limit = EXCLUDED.tokens_limit,
        bank_account_limit = EXCLUDED.bank_account_limit,
        iap_entitlement_id = EXCLUDED.iap_entitlement_id,
        iap_source = EXCLUDED.iap_source,
        cancel_at_period_end = false,
        updated_at = NOW()
    `, [
      userId, plan, status, billing_cycle, expires_at,
      limits.document_limit, limits.monthly_upload_limit,
      limits.tokens_limit, limits.bank_account_limit,
      entitlement_id || null, 'revenuecat'
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('[sync-iap]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### Database Migration

```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS iap_entitlement_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS iap_source TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';
```

### Important Notes

- **Must be idempotent.** The same data may arrive multiple times (from the app after purchase AND from the RevenueCat webhook seconds later). Use `ON CONFLICT ... DO UPDATE`.
- **Do not reset usage counters** (`tokens_used`, `ai_questions_used`, `monthly_uploads_used`) on sync — those reset on their own monthly schedule.
- **`iap_source = 'revenuecat'`** distinguishes native IAP subscriptions from Stripe web subscriptions. This matters for cancel/upgrade flows — if `iap_source = 'revenuecat'`, the backend should NOT call Stripe APIs for that user's subscription management.

---

## 2. POST /api/revenuecat/webhook

### Priority: CRITICAL — Without this, renewals, cancellations, and expirations that happen outside the app are never reflected in the database

### When it's called

RevenueCat's servers call this endpoint directly. The mobile app NEVER calls it. Events fire when:
- A new subscription is purchased
- A subscription renews automatically
- A user cancels in iOS Settings or Google Play
- A subscription expires (billing period ends after cancellation)
- Apple/Google billing retry fails
- A user gets a refund
- A user changes their subscription tier in the App Store

### Authentication

NOT a user bearer token. This is a **static shared secret** configured in both:
- RevenueCat Dashboard: Project Settings > Integrations > Webhooks > Authorization header
- Your backend: `REVENUECAT_WEBHOOK_SECRET` environment variable

```
Authorization: whsec_your_random_secret_here
Content-Type: application/json
```

### Request Body (sent by RevenueCat)

```json
{
  "api_version": "1.0",
  "event": {
    "type": "INITIAL_PURCHASE",
    "id": "evt_abc123",
    "app_user_id": "user_abc123",
    "product_id": "docuintelli_pro_monthly",
    "entitlement_ids": ["docuintelli_pro"],
    "period_type": "NORMAL",
    "purchased_at_ms": 1716307200000,
    "expiration_at_ms": 1718899200000,
    "store": "APP_STORE",
    "environment": "PRODUCTION",
    "currency": "USD",
    "price": 14.99,
    "price_in_purchased_currency": 14.99,
    "country_code": "US",
    "subscriber_attributes": {},
    "transaction_id": "2000000123456789",
    "original_transaction_id": "2000000123456789",
    "is_family_share": false
  }
}
```

### Event Types and Actions

| Event Type | Action | SQL |
|------------|--------|-----|
| `INITIAL_PURCHASE` | Activate subscription | `UPDATE subscriptions SET plan=$1, status='active', current_period_end=$2, cancel_at_period_end=false ...` |
| `RENEWAL` | Extend period | `UPDATE subscriptions SET status='active', current_period_end=$1, cancel_at_period_end=false ...` |
| `PRODUCT_CHANGE` | Change plan tier | `UPDATE subscriptions SET plan=$1, status='active', current_period_end=$2 ...` |
| `CANCELLATION` | Mark canceling | `UPDATE subscriptions SET cancel_at_period_end=true ...` |
| `EXPIRATION` | Downgrade to free | `UPDATE subscriptions SET plan='free', status='canceled', document_limit=3, monthly_upload_limit=3, tokens_limit=50000, bank_account_limit=0 ...` |
| `BILLING_ISSUE_DETECTED` | Flag payment issue | `UPDATE subscriptions SET status='past_due' ...` |
| `REFUND` | Downgrade to free immediately | Same as EXPIRATION |
| `SUBSCRIBER_ALIAS` | No-op | Log it, no DB change needed |
| `TEST` | Verification | Return 200, no DB change |

### Response

**Always return 200 OK** — even on errors. RevenueCat retries non-2xx responses with exponential backoff, which can cause duplicate processing.

```json
{
  "success": true
}
```

### Implementation

```javascript
const RC_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

const PLAN_LIMITS = {
  free:    { document_limit: 3,   monthly_upload_limit: 3,   tokens_limit: 50000,   bank_account_limit: 0 },
  starter: { document_limit: 25,  monthly_upload_limit: 30,  tokens_limit: 500000,  bank_account_limit: 1 },
  pro:     { document_limit: 100, monthly_upload_limit: 150, tokens_limit: 2000000,  bank_account_limit: 5 },
};

router.post('/revenuecat/webhook', async (req, res) => {
  // Verify shared secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== RC_WEBHOOK_SECRET) {
    console.warn('[RC Webhook] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event } = req.body;
  if (!event) {
    return res.status(200).json({ success: true }); // graceful no-op
  }

  const { type, app_user_id, product_id, entitlement_ids, expiration_at_ms } = event;

  console.log(`[RC Webhook] ${type} | user=${app_user_id} | product=${product_id}`);

  try {
    // Derive plan and billing cycle from product_id
    const plan = product_id?.includes('pro') ? 'pro'
      : product_id?.includes('starter') ? 'starter'
      : 'free';
    const billingCycle = product_id?.includes('yearly') ? 'yearly' : 'monthly';
    const expiresAt = expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null;
    const entitlementId = entitlement_ids?.[0] || null;

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        const limits = PLAN_LIMITS[plan];
        await db.query(`
          UPDATE subscriptions SET
            plan = $1, status = 'active', billing_cycle = $2,
            current_period_end = $3, cancel_at_period_end = false,
            document_limit = $4, monthly_upload_limit = $5,
            tokens_limit = $6, bank_account_limit = $7,
            iap_entitlement_id = $8, iap_source = 'revenuecat',
            updated_at = NOW()
          WHERE user_id = $9
        `, [plan, billingCycle, expiresAt,
            limits.document_limit, limits.monthly_upload_limit,
            limits.tokens_limit, limits.bank_account_limit,
            entitlementId, app_user_id]);
        break;
      }

      case 'CANCELLATION': {
        await db.query(`
          UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW()
          WHERE user_id = $1
        `, [app_user_id]);
        break;
      }

      case 'EXPIRATION':
      case 'REFUND': {
        const free = PLAN_LIMITS.free;
        await db.query(`
          UPDATE subscriptions SET
            plan = 'free', status = 'canceled', cancel_at_period_end = false,
            document_limit = $1, monthly_upload_limit = $2,
            tokens_limit = $3, bank_account_limit = $4,
            iap_entitlement_id = NULL, updated_at = NOW()
          WHERE user_id = $5
        `, [free.document_limit, free.monthly_upload_limit,
            free.tokens_limit, free.bank_account_limit, app_user_id]);
        break;
      }

      case 'BILLING_ISSUE_DETECTED': {
        await db.query(`
          UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
          WHERE user_id = $1
        `, [app_user_id]);
        break;
      }

      default:
        console.log(`[RC Webhook] Unhandled: ${type}`);
    }
  } catch (err) {
    console.error('[RC Webhook] Error:', err);
    // Still return 200 to prevent infinite retries
  }

  res.status(200).json({ success: true });
});
```

### Environment Variable

```bash
REVENUECAT_WEBHOOK_SECRET=whsec_your_random_secret_here
```

### RevenueCat Dashboard Setup

1. Go to **Project Settings** > **Integrations** > **Webhooks**
2. Click **+ New**
3. URL: `https://docuintelli.com/api/revenuecat/webhook`
4. Authorization header: paste your `REVENUECAT_WEBHOOK_SECRET` value
5. Save and click **Send test event** to verify

---

## 3. GET /api/account/export

### Priority: HIGH — Required for GDPR Article 20 (data portability) and App Store guidelines

### When it's called

From Settings > Security > "Export My Data" button. The user taps it, the app downloads the JSON and opens the native share sheet.

### Authentication

```
Authorization: Bearer <jwt_access_token>
```

### Request

`GET /api/account/export` — no body, no query params.

### Response

**Success (200):**

```json
{
  "exported_at": "2026-05-22T20:30:00.000Z",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "display_name": "John Doe",
    "full_name": "John Doe",
    "date_of_birth": "1990-01-15",
    "phone": "+1234567890",
    "created_at": "2025-03-01T10:00:00.000Z"
  },
  "subscription": {
    "plan": "pro",
    "status": "active",
    "billing_cycle": "monthly",
    "current_period_end": "2026-06-22T00:00:00.000Z"
  },
  "documents": [
    {
      "id": "doc_abc123",
      "name": "Lease Agreement",
      "category": "lease",
      "type": "application/pdf",
      "size": "2.4 MB",
      "upload_date": "2025-04-10T14:30:00.000Z",
      "expiration_date": "2026-04-10T00:00:00.000Z",
      "tags": ["apartment", "rent"],
      "status": "active"
    }
  ],
  "notifications": {
    "email_notifications": true,
    "document_reminders": true,
    "security_alerts": true,
    "billing_alerts": true
  },
  "devices": [
    {
      "id": "dev_abc123",
      "device_name": "iPhone 15 Pro",
      "last_active": "2026-05-22T18:00:00.000Z"
    }
  ],
  "activity_log": [
    {
      "action": "document_uploaded",
      "document_name": "Lease Agreement",
      "timestamp": "2025-04-10T14:30:00.000Z"
    },
    {
      "action": "chat_question",
      "question": "When does my lease expire?",
      "timestamp": "2025-04-10T15:00:00.000Z"
    }
  ]
}
```

**Auth Error (401):**
```json
{
  "error": "Not authenticated"
}
```

**Server Error (500):**
```json
{
  "error": "Failed to export data"
}
```

### Implementation

```javascript
router.get('/account/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all user data in parallel
    const [
      profileResult,
      subscriptionResult,
      documentsResult,
      devicesResult,
      activityResult,
    ] = await Promise.all([
      db.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]),
      db.query(`
        SELECT id, name, category, type, size, upload_date, expiration_date, tags, status
        FROM documents WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]),
      db.query('SELECT id, device_name, last_active FROM devices WHERE user_id = $1', [userId]),
      db.query(`
        SELECT action, details, created_at as timestamp
        FROM activity_log WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 500
      `, [userId]),
    ]);

    const profile = profileResult.rows[0] || {};
    const subscription = subscriptionResult.rows[0] || {};

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: req.user.email,
        display_name: profile.display_name,
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        phone: profile.phone,
        created_at: profile.created_at,
      },
      subscription: {
        plan: subscription.plan || 'free',
        status: subscription.status || 'active',
        billing_cycle: subscription.billing_cycle || 'monthly',
        current_period_end: subscription.current_period_end,
      },
      documents: documentsResult.rows,
      notifications: {
        email_notifications: profile.email_notifications,
        document_reminders: profile.document_reminders,
        security_alerts: profile.security_alerts,
        billing_alerts: profile.billing_alerts,
      },
      devices: devicesResult.rows,
      activity_log: activityResult.rows,
    };

    res.json(exportData);
  } catch (err) {
    console.error('[account/export]', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});
```

### Important Notes

- **Do NOT include** raw document file contents (binary blobs) — only metadata. Users can download individual documents from the vault.
- **Do NOT include** password hashes, JWT tokens, or internal IDs that expose system internals.
- **Rate limit** this endpoint — max 1 export per user per hour to prevent abuse.
- The response is saved as-is to a `.json` file on the user's device and shared via the OS share sheet.

---

## 4. Static Files: Universal Links

### Priority: MEDIUM — Required for email deep links (e-sign invites, password reset) to open directly in the app

These are static JSON files served at well-known URLs. No dynamic logic needed.

### iOS: apple-app-site-association

**URL:** `https://docuintelli.com/.well-known/apple-app-site-association`

**Content-Type:** `application/json` (no `.json` extension in the URL)

**Must NOT have a redirect** — Apple fetches this directly and rejects if it gets a 301/302.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["YOUR_TEAM_ID.com.docuintelli.app"],
        "paths": [
          "/sign/*",
          "/reset-password",
          "/emergency-invite",
          "/vault"
        ]
      }
    ]
  }
}
```

Replace `YOUR_TEAM_ID` with your Apple Developer Team ID (found in Apple Developer Portal > Membership > Team ID).

**Paths explained:**
- `/sign/*` — e-signature signing links from email
- `/reset-password` — password reset links from email
- `/emergency-invite` — emergency access invite links
- `/vault` — cloud storage OAuth callback

### Android: assetlinks.json

**URL:** `https://docuintelli.com/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.docuintelli.app",
      "sha256_cert_fingerprints": [
        "YOUR_RELEASE_KEYSTORE_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

Get the SHA-256 fingerprint from your release keystore:
```bash
keytool -list -v -keystore your-release.keystore -alias docuintelli | grep SHA256
```

Or from Play Console: Setup > App signing > App signing key certificate > SHA-256 fingerprint.

### Hosting Notes

- Both files must be served from the root domain `docuintelli.com`, NOT a subdomain
- Must be served over HTTPS with a valid certificate
- Must return `Content-Type: application/json`
- Must NOT require authentication
- Must NOT redirect (return 200 directly)
- Apple caches this file — changes may take 24-48 hours to propagate

---

## 5. Product & Entitlement Reference

### RevenueCat Entitlements

| Entitlement ID | Plan |
|---|---|
| `docuintelli_starter` | Starter ($9/mo or $90/yr) |
| `docuintelli_pro` | Pro ($15/mo or $150/yr) |

### App Store / Play Store Products

| Product ID | Plan | Billing | Price |
|---|---|---|---|
| `docuintelli_starter_monthly` | Starter | Monthly | $8.99 |
| `docuintelli_starter_yearly` | Starter | Yearly | $89.99 |
| `docuintelli_pro_monthly` | Pro | Monthly | $14.99 |
| `docuintelli_pro_yearly` | Pro | Yearly | $149.99 |

### Plan Limits (must match between backend and app)

| Field | Free | Starter | Pro |
|---|---|---|---|
| `document_limit` | 3 | 25 | 100 |
| `monthly_upload_limit` | 3 | 30 | 150 |
| `tokens_limit` | 50,000 | 500,000 | 2,000,000 |
| `bank_account_limit` | 0 | 1 | 5 |

---

## 6. Deployment Checklist

```
[ ] Run database migration (add iap_entitlement_id, iap_source, billing_cycle columns)
[ ] Deploy POST /api/subscription/sync-iap
[ ] Deploy GET /api/account/export
[ ] Deploy POST /api/revenuecat/webhook
[ ] Set REVENUECAT_WEBHOOK_SECRET in production env
[ ] Configure webhook URL in RevenueCat dashboard
[ ] Send test webhook from RevenueCat dashboard to verify
[ ] Host /.well-known/apple-app-site-association
[ ] Host /.well-known/assetlinks.json
[ ] Test sync-iap with curl:
    curl -X POST https://docuintelli.com/api/subscription/sync-iap \
      -H "Authorization: Bearer <token>" \
      -H "Content-Type: application/json" \
      -d '{"plan":"starter","billing_cycle":"monthly","entitlement_id":"docuintelli_starter","expires_at":"2026-07-22T00:00:00Z"}'
[ ] Test account/export with curl:
    curl https://docuintelli.com/api/account/export \
      -H "Authorization: Bearer <token>" | jq .
[ ] Verify GET /api/subscription/current returns updated plan after sync-iap
[ ] Test a sandbox IAP purchase end-to-end (app -> sync-iap -> subscription/current)
```
