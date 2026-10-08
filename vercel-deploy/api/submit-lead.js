// Vercel serverless function: POST /api/submit-lead
// Forwards validated lead JSON to the GoHighLevel inbound webhook stored in GHL_WEBHOOK_URL.

const GOALS = ['More Patients', 'Higher Quality Patients', 'More Cosmetic Patients', 'More General Patients', 'More recognizable brand'];
const REVENUES = ['Under 50k', '50-150k', '150k-250k', '250k+'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Basic in-memory rate limit: 5 submissions per IP per 10 minutes (per warm instance).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return list.length > MAX_HITS;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validate(body) {
  const lead = {
    first_name: str(body.first_name, 80),
    last_name: str(body.last_name, 80),
    email: str(body.email, 254).toLowerCase(),
    phone: str(body.phone, 30),
    social_media_goals: str(body.social_media_goals, 300),
    monthly_revenue: str(body.monthly_revenue, 30),
    page_url: str(body.page_url, 500),
  };
  const errors = [];
  if (!lead.first_name) errors.push('first_name is required');
  if (!lead.last_name) errors.push('last_name is required');
  if (!EMAIL_RE.test(lead.email)) errors.push('email is invalid');
  const digits = lead.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.push('phone is invalid');
  const goals = lead.social_media_goals.split(',').map(g => g.trim()).filter(Boolean);
  if (!goals.length || goals.some(g => !GOALS.includes(g))) errors.push('social_media_goals is invalid');
  if (!REVENUES.includes(lead.monthly_revenue)) errors.push('monthly_revenue is invalid');
  lead.qualified = lead.monthly_revenue && lead.monthly_revenue !== 'Under 50k' ? 'yes' : 'no';
  lead.submitted_at = new Date().toISOString();
  return { lead, errors };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const webhook = process.env.GHL_WEBHOOK_URL;
  if (!webhook) {
    console.error('GHL_WEBHOOK_URL is not set');
    return res.status(500).json({ ok: false, error: 'Form is not configured yet. Please try again later.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please wait a few minutes and try again.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }

  // Honeypot: bots fill hidden fields. Pretend success, forward nothing.
  if (str(body.website_url_hp, 200)) {
    return res.status(200).json({ ok: true });
  }

  const { lead, errors } = validate(body);
  if (errors.length) {
    return res.status(400).json({ ok: false, error: 'Please check your details and try again.', fields: errors });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      console.error('GHL webhook responded', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ ok: false, error: 'We could not submit your details. Please try again.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('GHL webhook request failed', err && err.message);
    return res.status(502).json({ ok: false, error: 'We could not submit your details. Please try again.' });
  }
};
