# toddy.meme

Official website of **$TODDY — The Night Trader of Crypto**. A static site (plain HTML, CSS and JavaScript, no build step) served by Cloudflare. GitHub holds the source code only; visitors never depend on GitHub being online.

## What is in this folder

| Path | Purpose |
|---|---|
| `index.html` | The home page (hero, story, tokenomics snapshot, launch & safety, roadmap, community, FAQ) |
| `linktree.html` + `linktree.css` + `linktree.js` | The official-links page ("coffee tree") |
| `privacy.html`, `terms.html`, `404.html` + `legal.css` | Privacy Policy, Terms & Disclaimer, and the not-found page |
| `style.css`, `script.js` | Shared styles and behaviour for the home page |
| `assets/` | Images, hero videos and icons |
| `_headers` | Security headers (CSP, HSTS, …) and cache rules, applied by Cloudflare |
| `wrangler.jsonc` | Cloudflare deployment settings |
| `.assetsignore` | Files that are **not** published (README, config, docs) |
| `robots.txt`, `sitemap.xml`, `site.webmanifest` | Search-engine and browser metadata |
| `games/` | Free TODDY browser games (see Games below) |
| `.well-known/security.txt` | Where researchers report security problems |
| `CHANGES.md` | What changed in the 2026-10-09 hardening pass, and why |
| `CNAME` | Left over from GitHub Pages; ignored on Cloudflare (listed in `.assetsignore`) |

## Rules that keep the site secure

The site runs under a strict Content-Security-Policy (see `_headers`). In practice:

1. **No inline `<script>` and no inline `<style>`/`style=""` in HTML.** Put code in `script.js` / `linktree.js` and styles in the `.css` files. (Setting styles from JavaScript, e.g. `el.style.width = …`, is fine.)
2. **Only `'self'` and Google Fonts** are allowed. Adding a new third-party script, font host, analytics tag or embed means editing the CSP on purpose — never loosen it with `unsafe-inline` or `*`.
3. **No secrets in this repository**, ever (API keys, signing keys, service-role keys). They belong in Cloudflare secrets.
4. After any change, open the page with the browser console open: a blocked resource shows as "Refused to … Content Security Policy".

## Deploying

Cloudflare builds from this folder (`wrangler.jsonc` → `assets.directory = "."`). Before pushing to production:

1. Run a preview deploy (`npx wrangler deploy --dry-run`, or a Cloudflare preview/branch deployment) and open it.
2. Check the response headers on the preview: `curl -sI https://<preview-url>/` should list `content-security-policy`, `strict-transport-security`, `x-content-type-options`, etc.
3. Confirm `https://<preview-url>/wrangler.jsonc` and `/README.md` return **404** (they must not be public).
4. Confirm `https://<preview-url>/.well-known/security.txt` loads and an unknown URL shows the 404 page.
5. Keep the previous deployment available so you can roll back from the Cloudflare dashboard.

Cloudflare account hygiene that matters more than any code: hardware-key or app-based 2FA on the Cloudflare, registrar, GitHub and social accounts; registrar lock and DNSSEC on `toddy.meme`; SPF/DKIM/DMARC records if the domain ever sends email; register obvious look-alike domains.

## TGE checklist — publishing the contract address

When the chain and contract are final, update **every** place below in one commit, then re-check the live site and all social profiles show the same address:

- `index.html` — hero box (`#ca-text`, "TBA at TGE"), Launch & Safety (`#safety-ca-text`, `#official-explorer`), the "Chain TBA / TBA" values in the head (`og:description`, `twitter:description`, `description`), the tokenomics "Launch Chain" card and the "launch chain" pill, the hero snapshot, and the FAQ answers that say "will be published".
- `linktree.html` — the safety notice and the `description` / `og:description` / `twitter:description` meta tags.
- `terms.html` — section 2 ("TBA").
- The disabled DEX Screener icons (index + footer) — turn them into real links.
- Remove "pre-launch" wording and the roadmap "Phase 1" items as they complete.

## Games (added 2026-10-12, beta)

| Path | What |
|---|---|
| `games/index.html` + `games/games.css` + `games/img/` | The Games page (Moon Brew first, then Night Shift), linked as "Play" in the nav and footer |
| `games/moon-brew/`, `games/night-shift/` | The built games. **Do not edit here**: they come from the `toddy-games` repo (its "Games bundle for toddy.meme" workflow publishes them on the `website-bundle` branch) and are replaced as a whole on each update |

- **Headers:** each game folder has its own CSP in `_headers` (the site CSP is detached there; adds `blob:` for share pictures and sound). The Games page keeps the site CSP.
- **Privacy:** section 5 of `privacy.html` covers the games (progress saved on the device only, no cookies, no play statistics). Update it **before** turning on any analytics, accounts or leaderboards.
- **Backend (later):** Cloudflare static assets can't validate scores or run accounts. When needed, add a Worker (see the commented lines in `wrangler.jsonc`) plus a database; scores and XP are validated on the server only, and new endpoints go into the game CSP `connect-src`.

## Known limitations (honest list)

- Fonts still load from Google Fonts. Self-hosting them (Cinzel, Inter, Playfair Display as `.woff2` in `assets/fonts/`, plus `@font-face` rules) would remove the last third-party request and let the CSP drop `fonts.googleapis.com` / `fonts.gstatic.com`.
- The hero videos are ~4 MB each. They load only after the page has finished loading, only for the screen size in use, and not at all for visitors who prefer reduced motion or use Data Saver.
- The Reddit link points to a user profile, not a subreddit.
- `privacy.html` and `terms.html` are plain-language drafts written to match how the site works today. Have a qualified lawyer review them before launch, especially for the jurisdictions you target.
