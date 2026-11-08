# Toddy accounts (Google sign-in) — setup guide for the owner

What this is: a small service on `toddy.meme/api/*`. It lets players sign in with Google, pick a nickname and avatar, and delete their data.
It stores: an internal player id, Google's anonymous id, email, name (owner-only), nickname, avatar, a "hide me from leaderboards" switch, and when they agreed.
It never handles passwords, wallets or tokens. Guests keep playing exactly as before.

Step 1 = sign-in, session, profile, delete. Step 2 (this branch) adds saved progress per game (`/api/progress/<game>`) and the Account section in Moon Brew's Settings. Leaderboards come next.

## What I (Claude) built and tested
- `server/` code and `migrations/0001_accounts.sql`; `node --test tests/accounts.test.mjs` runs 10 checks on the real SQL (in-memory SQLite) with a faked Google reply.
- NOT tested: the real Google screens, real Cloudflare D1, and the Cloudflare config change (`wrangler.jsonc`). The preview link is the first real test.

## What you do (about 25 minutes, once). Screens can look slightly different from my words; the names stay the same.

### A. Make the Google sign-in key
1. Open https://console.cloud.google.com and sign in with the Google account you want to own this (a team account, not a personal one if possible).
2. Top bar: click the project name > **New project** > name it `Toddy Games` > **Create**. Make sure it is selected at the top.
3. Left menu (three lines) > **APIs & Services** > **OAuth consent screen** (may be called **Google Auth Platform**). Click **Get started**.
4. App name `Toddy Games`; support email = your email; **Next**. Audience: **External**; **Next**. Contact email = your email; **Next**; tick the agreement; **Create**.
5. In **Branding** (or Edit app) add the links: Home page `https://toddy.meme`, Privacy policy `https://toddy.meme/privacy.html`, Terms `https://toddy.meme/terms.html`. Save.
6. In **Data access** (Scopes) make sure only these three are listed: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Nothing else. Save.
7. In **Audience**, click **Publish app** (so anyone, not only test users, can sign in). With only these basic scopes Google does not need a long review.
8. Left menu > **Clients** (or Credentials > **Create credentials** > **OAuth client ID**). Type: **Web application**; name `Toddy website`.
9. **Authorized redirect URIs** > Add URI. Add both:
   - `https://toddy.meme/api/auth/google/callback`
   - `https://accounts-step1-toddy-meme.bantu-bhasker.workers.dev/api/auth/google/callback` (the test link; I will tell you if the address differs)
   Leave "Authorized JavaScript origins" empty. **Create**.
10. A box shows **Client ID** and **Client secret**. Copy both somewhere private for step C. Never paste the secret in a chat or in GitHub.

### B. Make the database in Cloudflare
1. https://dash.cloudflare.com > **Storage & databases** > **D1 SQL database** > **Create database**. Name `toddy-accounts`. Location: Western Europe (EU). **Create**.
2. Open it > **Console** tab. Open `migrations/0001_accounts.sql` from this repo (GitHub: click the file > **Raw**), copy everything, paste into the console, click **Execute**. Then do the same with `migrations/0002_progress.sql`. Together they create four tables.
3. Copy the **Database ID** (on the database's overview page; it is not a secret). Send it to me and I switch the database on in `wrangler.jsonc`.

### C. Secrets (Cloudflare dashboard, never in GitHub)
1. **Workers & Pages** > **toddy-meme** > **Settings** > **Variables and Secrets** > **Add**. Type **Secret** each time:
   - `GOOGLE_CLIENT_ID` = the Client ID from A.10
   - `GOOGLE_CLIENT_SECRET` = the Client secret from A.10
   - `SESSION_SECRET` = a long random text, 40+ characters (mash letters and numbers, or ask me to make one for you, then store it only here)
2. **Deploy** when it asks.

### D. Check
Open `https://<test link>/api/health`. It should say `{"ok":true,"accounts":true}`. If it says `accounts:false`, a secret or the database is missing.

## Privacy page
`privacy.html` section 5 still says "progress saved in the browser, stats off". Before launch it must be updated to list what accounts store, why, how to delete, and that email is used only for sign-in and account contact. I will draft the text for your approval in step 6.

## Routes
GET `/api/health` · GET `/api/auth/google/start?anon=<guest id>&return=/games/<game>/` · GET `/api/auth/google/callback` · GET `/api/me` · POST `/api/me/profile` {nickname, avatar, showOnBoards} · GET/PUT `/api/progress/<moon-brew|full-moon|scam-lab>` · POST `/api/logout` · POST `/api/me/delete`.
All POSTs must come from our own pages (Origin check). The session cookie is HttpOnly, Secure, SameSite=Lax, and only a hash of it is stored.

## Known gaps / decisions
- The nickname blocked-word list in `server/nickname.js` is a short starter; extend before launch.
- No rate limiting yet: add a Cloudflare rate-limit rule on `/api/*` (dashboard > Security > WAF > Rate limiting) before launch.
- Avatars: the code allows 8 (0-7); the pictures come with the account menu in step 2.
