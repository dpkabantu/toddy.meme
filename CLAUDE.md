# toddy.meme — rules for anyone (human or AI) changing this site

Static site, no build step on Cloudflare. Read README.md for security rules (strict CSP: no inline scripts/styles, no new third-party origins, no secrets).

## Games list: one source of truth
`games/catalog.json` is the ONLY place games are listed. `node tools/build-games.mjs` writes from it:
- the menu "Play" link and its gold "new" dot (index.html)
- the home Play section: max 4 cards, the `featured` game first, then the newest
- the whole `/games/` page (rows, filters, "Show more", search, "Coming soon")
- the games entries in sitemap.xml

Never hand-edit HTML between `<!-- GAMES:…:START -->` and `<!-- GAMES:…:END -->`; it is overwritten.
GitHub Actions runs `node tools/build-games.mjs --check` on every push and fails if the pages are stale or the catalog is invalid.

## Adding a game (about 10 minutes)
1. Game files in `games/<id>/` (own `index.html`; game code loads only on that route).
2. Card picture: `assets/games/<id>-card.webp`, exactly 800×450, under 150 KB.
3. Add an entry to `games/catalog.json` (copy an existing one). Fields: `id`, `title` (≤28), `path` (`/games/<id>/`), `status` (`beta` | `live` | `soon`), `category` (a key of `categories`), `daily`, `minutes`, `orientation` (`upright` | `sideways` | `any`), `meta` (card line), `text` (≤110), optional `hubText` (≤160), `card`, `cardAlt`, optional `featured` (max one game), `added`, optional `updated` (dates YYYY-MM-DD).
4. `node tools/build-games.mjs`, check the result locally, commit everything together.
5. Push to a test branch, open the Cloudflare preview (`<branch>-toddy-meme.bantu-bhasker.workers.dev`), and get the owner's OK before merging to main. Nothing goes live without the owner's permission.

Updating a game: copy the new files over its folder, bump `updated` in the catalog, rebuild.
New category: add it to `categories`; the filter button appears by itself.

## Layout rules (in `RULES` at the top of tools/build-games.mjs)
"New" badge 21 days, menu dot 7 days (expire in the browser by date) · "Today's Dailies" row at 3+ daily games · filters and "New this week" at 6+ games · "Show more games" past 12 · search at 20+.

## Menu
Every menu link scrolls on the home page, in page order: Meet Toddy · Play · Tokenomics · Launch & Safety · Roadmap · Community · FAQ. After FAQ comes one more item that goes to `/season/` ("Season 1 · Sign in", or the player's name once signed in); it is hidden unless the Season server answers (`season/nav.js`). No per-game links in the menu. "All Links" (linktree.html) is linked from the footer, the Launch & Safety section and the FAQ, and is the link for social bios.
