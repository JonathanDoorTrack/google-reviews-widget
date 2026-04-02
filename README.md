# Google Reviews Widget

Self-hosted embeddable Google Reviews widget. A Railway server fetches all reviews from the Google Business Profile API daily and serves them via a `/reviews` JSON endpoint and a drop-in `/widget.js` embed script.

---

## Architecture

```
Railway (Node.js / Express)
  ├── GET /reviews      → returns cached reviews as JSON
  ├── GET /widget.js    → serves the embeddable vanilla JS widget
  └── GET /health       → cache status check

Daily cron job (03:00) → Google Business Profile API → cache/reviews.json
```

---

## Step 1 — Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or use an existing one).
2. Navigate to **APIs & Services → Library**.
3. Search for and enable:
   - **My Business Notifications API**
   - **My Business Account Management API**
   - **My Business Business Information API**
   - **My Business Reviews API** *(this is what you actually need)*

   > If you can't find "My Business Reviews API" directly, enable **Google My Business API**. Note: The Business Profile APIs require you to apply for access at [developers.google.com/my-business/content/prereqs](https://developers.google.com/my-business/content/prereqs) if using a new project. As a verified owner you will be approved.

4. Navigate to **APIs & Services → Credentials**.
5. Click **Create Credentials → OAuth 2.0 Client ID**.
6. Application type: **Desktop app** (this is for the one-time local auth flow).
7. Copy the **Client ID** and **Client Secret** — you'll need these next.

---

## Step 2 — Find your Account ID and Location ID

**Account ID:**
1. Go to [business.google.com](https://business.google.com).
2. Look at the URL — it contains your account ID:
   `https://business.google.com/u/0/manage/#/account/123456789/...`
3. Alternatively, after completing OAuth setup you can call:
   `GET https://mybusiness.googleapis.com/v4/accounts`
   with your access token to list accounts and their IDs.

**Location ID:**
1. In Business Profile Manager, open your location.
2. The URL will contain your location ID:
   `https://business.google.com/u/0/manage/#/account/123456789/location/987654321/...`

---

## Step 3 — Local Setup

```bash
cd google-reviews-widget
npm install
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID
```

---

## Step 4 — Get your Refresh Token (one-time)

```bash
npm run auth
# or: node auth/get-token.js
```

This will:
1. Open your browser to Google's OAuth consent screen
2. Ask you to sign in with the Google account that owns the Business Profile
3. Print the refresh token to your terminal

Copy the refresh token into your `.env` file:
```
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
```

> **Important:** If you do not receive a refresh token, go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), revoke the app's access, and run `npm run auth` again. The `prompt: 'consent'` flag forces Google to issue a new refresh token.

---

## Step 5 — Test locally

```bash
node server.js
```

- `http://localhost:3000/health` — check cache status
- `http://localhost:3000/reviews` — see cached reviews JSON
- `http://localhost:3000/widget.js` — the embed script

---

## Step 6 — Deploy to Railway

1. Push this project to a GitHub repo (or a subdirectory of your existing repo).
2. Create a new Railway service pointing at this directory.
3. Set the following environment variables in Railway:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | From `npm run auth` |
| `GOOGLE_ACCOUNT_ID` | Numeric account ID |
| `GOOGLE_LOCATION_ID` | Numeric location ID |

Railway automatically sets `PORT` — do not override it.

4. Deploy. The server fetches reviews on startup and then daily at 03:00.

---

## Step 7 — Embed the widget

Drop this into any HTML page:

```html
<div id="google-reviews"></div>
<script src="https://your-app.up.railway.app/widget.js"></script>
```

### Optional config

Set `window.GoogleReviewsConfig` **before** the script tag:

```html
<div id="google-reviews"></div>
<script>
  window.GoogleReviewsConfig = {
    maxReviews: 6,       // Limit number shown (default: all)
    minRating: 4,        // Only show 4★ and 5★ reviews (default: 0 = all)
    dateLocale: 'en-AU', // Date format locale (default: 'en-AU')
  };
</script>
<script src="https://your-app.up.railway.app/widget.js"></script>
```

### CSS customisation

Override the CSS variables on the `#google-reviews` container:

```css
#google-reviews {
  --gr-columns: repeat(3, 1fr);
  --gr-card-bg: #f9fafb;
  --gr-card-radius: 8px;
  --gr-star-color: #facc15;
  --gr-font-family: 'Inter', sans-serif;
}
```

All available variables:

| Variable | Default | Description |
|---|---|---|
| `--gr-font-family` | `inherit` | Font family |
| `--gr-columns` | `repeat(auto-fill, minmax(280px, 1fr))` | Grid columns |
| `--gr-gap` | `1.25rem` | Gap between cards |
| `--gr-card-bg` | `#ffffff` | Card background |
| `--gr-card-radius` | `12px` | Card border radius |
| `--gr-card-shadow` | `0 2px 12px rgba(0,0,0,0.08)` | Card shadow |
| `--gr-card-padding` | `1.25rem` | Card padding |
| `--gr-star-color` | `#f5a623` | Filled star colour |
| `--gr-star-empty` | `#d1d5db` | Empty star colour |
| `--gr-text-color` | `#111827` | Review text colour |
| `--gr-meta-color` | `#6b7280` | Date / secondary text colour |
| `--gr-avatar-bg` | `#e5e7eb` | Initials avatar background |
| `--gr-avatar-color` | `#374151` | Initials avatar text |
| `--gr-avatar-size` | `42px` | Avatar diameter |

---

## Endpoints

| Route | Description |
|---|---|
| `GET /reviews` | Cached reviews JSON `{ updatedAt, count, reviews[] }` |
| `GET /widget.js` | Embeddable widget script |
| `GET /health` | Cache status `{ status, cacheAvailable, cachedReviews, lastUpdated }` |

---

## Notes

- The cache is a JSON file (`cache/reviews.json`). It is regenerated on startup and daily at 03:00. If the API call fails, the previous cache is preserved and the server stays up.
- Token refresh is handled automatically by the `googleapis` library — the server will never go down due to an expired access token as long as the refresh token remains valid.
- Refresh tokens can be revoked if you change your Google account password or revoke app access. If that happens, re-run `npm run auth` and update `GOOGLE_REFRESH_TOKEN` in Railway.
