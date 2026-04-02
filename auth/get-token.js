/**
 * One-time OAuth2 authorization script.
 *
 * Run locally with:   node auth/get-token.js
 *
 * This opens your browser to Google's consent screen, waits for the
 * redirect callback, then prints the refresh token to copy into .env.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { google } = require('googleapis');
const http = require('http');
const { exec } = require('child_process');

const REDIRECT_URI = 'http://localhost:3001/oauth/callback';
const SCOPES = ['https://www.googleapis.com/auth/business.manage'];

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // Always show consent screen so Google returns a refresh token
});

console.log('\n────────────────────────────────────────────────────────────');
console.log('  Google Reviews Widget — One-Time OAuth Setup');
console.log('────────────────────────────────────────────────────────────\n');
console.log('Opening your browser to complete authorization...');
console.log('If the browser does not open, visit this URL manually:\n');
console.log(' ', authUrl, '\n');

// Open browser (macOS). Swap for 'xdg-open' on Linux or 'start' on Windows.
exec(`open "${authUrl}"`);

// Local server to capture the OAuth callback
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:3001`);

    if (url.pathname !== '/oauth/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<p>Authorization failed: <strong>${error}</strong>. You can close this tab.</p>`);
      console.error('\n❌  Authorization was denied or failed:', error);
      server.close();
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<p>No authorization code received. You can close this tab.</p>');
      server.close();
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<p>✅ Authorization complete! Check your terminal for the refresh token. You can close this tab.</p>');

    console.log('\n✅  Authorization successful!\n');

    if (tokens.refresh_token) {
      console.log('━━━ REFRESH TOKEN (copy this into Railway + your .env) ━━━\n');
      console.log(tokens.refresh_token);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('Add to .env:  GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    } else {
      console.warn('\n⚠️   No refresh token returned.');
      console.warn('This usually means the app already has a token issued.');
      console.warn('Go to https://myaccount.google.com/permissions, revoke access,');
      console.warn('and run this script again.\n');
    }

    server.close();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<p>Error: ${err.message}. Check your terminal.</p>`);
    console.error('\n❌  Token exchange failed:', err.message);
    server.close();
  }
});

server.listen(3001, () => {
  console.log('Listening for OAuth callback on http://localhost:3001 …\n');
});
