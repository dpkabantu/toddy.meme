# What changed — 2026-10-09 hardening pass

Your original files were not modified; this folder is an improved copy. Nothing was removed from `style.css` (all additions are appended at the end) and the visual design is unchanged apart from the items marked **visible**.

## How it was checked (and what could not be)

Checked locally in a real Chromium browser against both your original and this version: 61 functional checks (CSP violations, which video loads, FAQ/keyboard/menu behaviour, reduced-motion mode, headers, 404, broken links), an automated colour-contrast audit measured against the actual rendered pixels (including 12 frames of the hero video), keyboard tab-order, and before/after screenshots.

**Not verifiable here:** how Cloudflare itself treats `_headers`, `.assetsignore`, `not_found_handling` and `.well-known/` (my test server only imitates it), live Lighthouse scores, real-device performance, and Google Fonts (the sandbox has no internet). Use the deploy checklist in `README.md` on a preview deployment before going live.

## Security
- `_headers` (new): strict Content-Security-Policy (only your own files + Google Fonts), HSTS, no-sniff, anti-framing, referrer and permissions policies. Inline scripts/styles were moved to files so the policy can stay strict.
- `.assetsignore` (new) + `wrangler.jsonc`: `wrangler.jsonc`, `README.md`, `CNAME` were publicly downloadable before; they no longer are. Unknown URLs now return a proper 404 page.
- `.well-known/security.txt` (new): public contact for vulnerability / phishing reports (currently points to your X profile, change it if you prefer).
- New "Official links only" box + 2 FAQ answers on spotting fake sites; safety notice on the links page.

## Accessibility (visible where noted)
- **Contrast:** 17 desktop / 16 mobile text failures (WCAG AA) reduced to 0, including the hero headline and sub-text over the video on phones (as low as 2:1 before). **Visible:** a soft dark gradient behind the hero text, brighter small text, a few tiny labels enlarged (9–10px → 11–12px); footer text on the links page now sits on a dark panel.
- **Visible:** pause/play button on the hero video (required for auto-moving content).
- FAQ: removed a keyboard handler that could toggle twice in some browsers; collapsed answers are now truly hidden from screen readers and tab order; 16 redundant landmarks removed.
- Decorative emoji hidden from screen readers; meaningful alt text on all mascot images; page `<h1>`/`<main>` on the links page; focus moves to the section after menu jumps; smooth-scroll respects "reduce motion".

## Performance
- Hero video starts after the page has loaded; none is downloaded for visitors with reduced-motion or Data Saver (they see the poster).
- Audio tracks (unused) stripped from the 4 videos, lossless: Safari/iPhone download ~0.4 MB less. I tested re-compressing the video; it came out larger at equal quality, so your original quality is kept.
- Social share images 2.6 MB → ~370 KB (same dimensions). Image width/height added (less layout jump), lazy-loading on below-the-fold images, hero poster preloaded.
- Scroll handlers throttled; navbar style is now a CSS class; sparkles pause when the tab is hidden.
- Honest note: total bytes for a normal desktop visit are essentially unchanged (~5.9 MB, ~4.2 MB of it the video).

## SEO / sharing
Removed obsolete meta keywords; added Organization + WebSite structured data, image alt for previews, `robots.txt`, `sitemap.xml`, app icons and web manifest, and Open Graph/Twitter tags for the links page (it had none).

## New pages
`privacy.html`, `terms.html`, `404.html` (linked from the footers). **The privacy and terms texts are plain-language drafts that match how the site works today — have a lawyer review them.**

## Prepared for games (nothing game-related added)
Reserved, commented-out blocks in `_headers`, `wrangler.jsonc` and `sitemap.xml`, a "GAMES HOOK" in the nav, and a games section in `README.md`; script code wrapped so nothing leaks into the global scope.

## Decisions (settled)
1. **Share image:** the old `og-image.jpg` carried the slogan "Good coffee, bigger gains", which clashes with "no financial return expectation". It is replaced by a clean version built from your banner artwork (same file name and size, no slogan).
2. **Kopi Luwak FAQ:** reworded to "Is TODDY a coffee company?" — no, Toddy is a fictional character, $TODDY is a meme coin, Kopi Luwak is the creative inspiration.
3. **Roadmap:** "Treasury operations" replaced with "Regular public progress updates". Before launch it is still worth publishing how the project is funded and who controls the wallets; no numbers were invented.
4. **Fonts (optional, later):** the site's letter styles are downloaded from Google every visit; keeping the font files on your own site would be a little faster and send no visitor data to Google. Not done here (no internet access in my workspace); see README.
5. The Reddit link goes to a user profile, not a subreddit.
