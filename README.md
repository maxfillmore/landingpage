# GM Media landing page — Vercel deploy

Upload everything in this folder to the TOP LEVEL of your GitHub repo:

- `opt-in/index.html` — landing page + quiz → /opt-in
- `calendar/index.html` — qualified leads (booking calendar, contact info prefilled) → /calendar
- `not-qualified/index.html` — disqualified leads → /not-qualified
- `api/submit-lead.js` — serverless function that forwards leads to GoHighLevel
- `vercel.json` — sends the bare domain (/) to /opt-in

Delete any old `index.html` at the repo root.

Requires the `GHL_WEBHOOK_URL` environment variable in Vercel (already set on the landing page project).
