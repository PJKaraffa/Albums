# Karaffa Vault LP Collection Manager

A shared family LP collection backed by Supabase. It includes account sign-in, collector attribution and filtering, multiple pressings of the same album, album search and filters, Goldmine-style vinyl/sleeve condition grades, pricing, collection totals, pasted/uploaded album covers, editing, deletion, and CSV export.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste in `supabase.sql`, and run it once.
3. The supplied `app.js` is already connected to the Karaffa Vault Supabase project.
4. Upload every supplied file to GitHub, replacing the files with the same names. With GitHub Pages, choose **Settings → Pages → Deploy from a branch**.
5. If GitHub is already hosting an older copy, wait for the deployment to finish and then press **Ctrl+F5** to force-refresh the page.

Never put the Supabase `service_role` key in this webpage. The anon key is intended for browser use; the included Row Level Security policies keep every collector's records private.

## Files

- `index.html` — page structure
- `styles.css` — responsive visual design
- `cover-upload.css` — album-cover upload and preview styling
- `folders.html` — fast Genre and Style folder browser
- `folders.js` — automatic folder and album navigation
- `folders.css` — folder page styling

## Genre and Style upgrade

Run `supabase.sql` again once to add the new `style` column. Existing albums remain intact and appear under **No Style Assigned** until edited. Upload `folders.html`, `folders.js`, and `folders.css` beside `index.html` in the GitHub repository root.
- `app.js` — authentication, catalog, search, filters, CRUD, and CSV export
- `supabase.sql` — database table, indexes, security policies, and timestamp trigger
