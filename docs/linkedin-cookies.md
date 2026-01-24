# Refreshing LinkedIn Cookies

The LinkedIn scraper requires valid session cookies to authenticate with LinkedIn. These cookies expire periodically and need to be refreshed.

## When to Refresh

Refresh cookies when:
- LinkedIn scraping starts failing with authentication errors
- The `li_at` cookie expires (check `expirationDate` in the JSON)
- You see "Failed to parse cookie data" errors in logs

## Prerequisites

1. Install the [Cookie Editor](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) Chrome extension
2. Have access to a LinkedIn account

## Steps to Export Cookies

1. **Log into LinkedIn**
   - Go to [linkedin.com](https://www.linkedin.com)
   - Sign in with your account
   - Make sure you're fully logged in (can see your feed)

2. **Open Cookie Editor**
   - Click the Cookie Editor extension icon in Chrome
   - You should see a list of LinkedIn cookies

3. **Export All Cookies**
   - Click the **Export** button (download icon)
   - Select **JSON** format
   - Copy the entire JSON array to clipboard

4. **Minify the JSON**
   - Go to [jsonformatter.org/json-minify](https://jsonformatter.org/json-minify) or use terminal:
     ```bash
     echo '<paste-json-here>' | jq -c '.'
     ```
   - Copy the minified (single-line) JSON

5. **Update Environment Variable**

   **Local Development:**
   - Open `.env.local`
   - Replace the `LINKEDIN_COOKIES` value with the new minified JSON:
     ```
     LINKEDIN_COOKIES=[{"domain":".linkedin.com",...}]
     ```

   **Vercel Production:**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Update `LINKEDIN_COOKIES` with the new value
   - Redeploy the project

## Important Cookies

The most critical cookies are:

| Cookie | Purpose |
|--------|---------|
| `li_at` | Main session token (required) |
| `JSESSIONID` | Session ID for API calls |
| `bscookie` | Browser session cookie |

## Cookie Expiration

Most LinkedIn cookies expire in ~1-2 years, but some short-lived cookies may expire sooner:
- `__cf_bm` - Cloudflare bot management (expires in hours)
- `lidc` - Load balancer cookie (expires in ~24 hours)

The scraper should still work as long as `li_at` is valid.

## Troubleshooting

**"LinkedIn cookies not configured"**
- Ensure `LINKEDIN_COOKIES` env var is set

**"Failed to parse cookie data"**
- Check JSON is valid and properly minified
- Ensure no line breaks in the env var value

**Scraper returns 0 posts**
- Cookies may be expired - refresh them
- LinkedIn may have logged out the session - log in again and re-export

## Security Notes

- Never commit cookies to git
- Cookies grant full access to the LinkedIn account
- Rotate cookies if you suspect they've been compromised
- Consider using a dedicated LinkedIn account for scraping
