# GM Media landing page — Vercel deploy

- `index.html` — the landing page (self-contained)
- `api/submit-lead.js` — serverless function that forwards leads to GoHighLevel

Set `GHL_WEBHOOK_URL` in Vercel → Project → Settings → Environment Variables, then deploy this folder with `vercel --prod`.
