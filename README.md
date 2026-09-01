# GrooveVault LP Collection Manager

A static HTML/CSS/JavaScript app backed by Supabase. It includes account sign-in, private per-user collections, album search and filters, Goldmine-style vinyl/sleeve condition grades, pricing, collection totals, cover images, editing, deletion, and CSV export.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste in `supabase.sql`, and run it once.
3. Open **Project Settings → API** and copy the Project URL and anon/public key.
4. In `app.js`, replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`.
5. Upload the four web files to GitHub. With GitHub Pages, choose **Settings → Pages → Deploy from a branch**.

Never put the Supabase `service_role` key in this webpage. The anon key is intended for browser use; the included Row Level Security policies keep every collector's records private.

## Files

- `index.html` — page structure
- `styles.css` — responsive visual design
- `app.js` — authentication, catalog, search, filters, CRUD, and CSV export
- `supabase.sql` — database table, indexes, security policies, and timestamp trigger
