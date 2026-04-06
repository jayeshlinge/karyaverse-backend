// =============================================
// KARYAVERSE BACKEND — server.js
// =============================================
// Express API server for Karyaverse
// Handles: tools, submissions, prompts, contact, newsletter
// Database: Supabase (PostgreSQL)
// =============================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ─── Supabase Client ───────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // service key for server-side ops
);

// ─── Middleware ────────────────────────────────────────────────────────────

// CORS — allow only your frontend domains
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g. Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiters ─────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // max 5 form submissions per hour per IP
  message: { error: 'Too many submissions. Please wait before trying again.' }
});

app.use(generalLimiter);

// ─── Auth Middleware (admin routes) ────────────────────────────────────────
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Helper: send email notification ──────────────────────────────────────
async function sendNotification(subject, html) {
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV === 'development') {
    console.log('[Email skipped in dev mode]', subject);
    return;
  }
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'noreply@karyaverse.com',
      to: process.env.NOTIFY_EMAIL || 'kartiki@karyaverse.com',
      subject,
      html
    });
  } catch (err) {
    console.error('[Email error]', err.message);
  }
}

// ─── Helper: validate email ────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Helper: sanitize text input ──────────────────────────────────────────
function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Karyaverse API ✦ Where limits disappear.',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ══════════════════════════════════════════════════════════════════════════
// TOOLS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/tools — fetch all tools (with optional filters)
// Query params: ?category=coding&access=free&search=chatgpt&limit=20&page=1
app.get('/api/tools', async (req, res) => {
  try {
    const { category, access, search, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('tools')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    if (category && category !== 'all') query = query.eq('category', category);
    if (access && access !== 'all')    query = query.eq('access_type', access);
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      tools: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit))
    });
  } catch (err) {
    console.error('[GET /api/tools]', err.message);
    res.status(500).json({ error: 'Failed to fetch tools.' });
  }
});

// GET /api/tools/categories — fetch all unique categories
app.get('/api/tools/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('category')
      .eq('is_active', true);

    if (error) throw error;

    const categories = [...new Set(data.map(t => t.category))].sort();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// GET /api/tools/:id — fetch single tool
app.get('/api/tools/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Tool not found.' });
    res.json({ success: true, tool: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tool.' });
  }
});

// POST /api/tools/click — track affiliate link click
app.post('/api/tools/click', async (req, res) => {
  try {
    const { tool_id } = req.body;
    if (!tool_id) return res.status(400).json({ error: 'tool_id required' });

    await supabase.rpc('increment_tool_clicks', { tool_id });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false }); // non-critical, don't error
  }
});

// ─── Admin: add a tool ─────────────────────────────────────────────────────
app.post('/api/admin/tools', requireAdmin, async (req, res) => {
  try {
    const {
      name, description, category, url, affiliate_url,
      access_type, tags, is_featured, is_verified
    } = req.body;

    if (!name || !url || !category) {
      return res.status(400).json({ error: 'name, url, category are required.' });
    }

    const { data, error } = await supabase.from('tools').insert([{
      name:          sanitize(name, 100),
      description:   sanitize(description, 1000),
      category:      sanitize(category, 100),
      url:           sanitize(url, 500),
      affiliate_url: affiliate_url ? sanitize(affiliate_url, 500) : null,
      access_type:   access_type || 'free',
      tags:          Array.isArray(tags) ? tags : [],
      is_featured:   Boolean(is_featured),
      is_verified:   Boolean(is_verified),
      is_active:     true
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, tool: data });
  } catch (err) {
    console.error('[POST /api/admin/tools]', err.message);
    res.status(500).json({ error: 'Failed to create tool.' });
  }
});

// ─── Admin: update a tool ──────────────────────────────────────────────────
app.put('/api/admin/tools/:id', requireAdmin, async (req, res) => {
  try {
    const updates = {};
    const allowed = ['name','description','category','url','affiliate_url',
                     'access_type','tags','is_featured','is_verified','is_active'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tools')
      .update(updates)
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, tool: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tool.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SUBMISSIONS (Innovation Lab)
// ══════════════════════════════════════════════════════════════════════════

// POST /api/submit-project — student project submission
app.post('/api/submit-project', submitLimiter, async (req, res) => {
  try {
    const { name, email, project, category, description, demo_url, school } = req.body;

    // Validate required fields
    if (!name || !email || !project || !description) {
      return res.status(400).json({
        error: 'Name, email, project name, and description are required.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Save to database
    const { data, error } = await supabase.from('submissions').insert([{
      name:        sanitize(name, 100),
      email:       sanitize(email, 200),
      project:     sanitize(project, 200),
      category:    sanitize(category, 100),
      description: sanitize(description, 2000),
      demo_url:    demo_url ? sanitize(demo_url, 500) : null,
      school:      school ? sanitize(school, 200) : null,
      status:      'pending',
      ip_address:  req.ip
    }]).select().single();

    if (error) throw error;

    // Send email notification to Kartiki
    await sendNotification(
      `New Karyaverse submission: ${sanitize(project, 100)}`,
      `
        <h2>New Project Submission</h2>
        <p><strong>Name:</strong> ${sanitize(name)}</p>
        <p><strong>Email:</strong> ${sanitize(email)}</p>
        <p><strong>Project:</strong> ${sanitize(project)}</p>
        <p><strong>Category:</strong> ${sanitize(category)}</p>
        <p><strong>School:</strong> ${sanitize(school || 'Not provided')}</p>
        <p><strong>Demo:</strong> ${demo_url || 'Not provided'}</p>
        <p><strong>Description:</strong><br>${sanitize(description)}</p>
        <hr>
        <p><a href="https://supabase.com">View in Supabase dashboard</a></p>
      `
    );

    res.status(201).json({
      success: true,
      message: 'Your project has been submitted! Kartiki will review it soon.',
      id: data.id
    });
  } catch (err) {
    console.error('[POST /api/submit-project]', err.message);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

// GET /api/admin/submissions — view all submissions (admin only)
app.get('/api/admin/submissions', requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('submissions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ success: true, submissions: data, total: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// PUT /api/admin/submissions/:id — update submission status
app.put('/api/admin/submissions/:id', requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'winner'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ success: true, submission: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update submission.' });
  }
});

// GET /api/submissions/winners — public: get winning projects
app.get('/api/submissions/winners', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('name, project, category, description, demo_url, school, created_at')
      .eq('status', 'winner')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, winners: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch winners.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PROMPTS
// ══════════════════════════════════════════════════════════════════════════

// GET /api/prompts — fetch all prompts
app.get('/api/prompts', async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('prompts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category && category !== 'all') query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, prompts: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prompts.' });
  }
});

// POST /api/prompts/copy — track prompt copy (analytics)
app.post('/api/prompts/copy', async (req, res) => {
  try {
    const { prompt_id } = req.body;
    if (prompt_id) {
      await supabase.rpc('increment_prompt_copies', { prompt_id });
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false }); // non-critical
  }
});

// ─── Admin: add a prompt ───────────────────────────────────────────────────
app.post('/api/admin/prompts', requireAdmin, async (req, res) => {
  try {
    const { title, type, category, prompt_text } = req.body;
    if (!title || !prompt_text || !category) {
      return res.status(400).json({ error: 'title, prompt_text, category required.' });
    }

    const { data, error } = await supabase.from('prompts').insert([{
      title:       sanitize(title, 200),
      type:        sanitize(type, 100),
      category:    sanitize(category, 100),
      prompt_text: sanitize(prompt_text, 3000),
      is_active:   true
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, prompt: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create prompt.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CONTACT / NEWSLETTER
// ══════════════════════════════════════════════════════════════════════════

// POST /api/contact — general contact message
app.post('/api/contact', submitLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const { error } = await supabase.from('contact_messages').insert([{
      name:    sanitize(name, 100),
      email:   sanitize(email, 200),
      subject: sanitize(subject, 300),
      message: sanitize(message, 3000),
      ip_address: req.ip
    }]);

    if (error) throw error;

    await sendNotification(
      `Karyaverse contact: ${sanitize(subject || 'New message')}`,
      `<p><strong>From:</strong> ${sanitize(name)} (${sanitize(email)})</p>
       <p><strong>Subject:</strong> ${sanitize(subject)}</p>
       <p><strong>Message:</strong><br>${sanitize(message)}</p>`
    );

    res.json({ success: true, message: 'Message sent! We will get back to you soon.' });
  } catch (err) {
    console.error('[POST /api/contact]', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// POST /api/newsletter — email newsletter signup
app.post('/api/newsletter', submitLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required.' });
    }

    // Upsert — don't error if already subscribed
    const { error } = await supabase.from('newsletter').upsert([{
      email:      sanitize(email, 200),
      name:       name ? sanitize(name, 100) : null,
      subscribed: true
    }], { onConflict: 'email' });

    if (error) throw error;

    res.json({ success: true, message: 'You are subscribed to Karyaverse AI news!' });
  } catch (err) {
    console.error('[POST /api/newsletter]', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ANALYTICS (admin only)
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [tools, submissions, prompts, newsletter, contact] = await Promise.all([
      supabase.from('tools').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('submissions').select('id, status', { count: 'exact' }),
      supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('newsletter').select('id', { count: 'exact', head: true }).eq('subscribed', true),
      supabase.from('contact_messages').select('id', { count: 'exact', head: true })
    ]);

    const subsByStatus = {};
    (submissions.data || []).forEach(s => {
      subsByStatus[s.status] = (subsByStatus[s.status] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        tools:           tools.count || 0,
        submissions:     submissions.count || 0,
        submissions_by_status: subsByStatus,
        prompts:         prompts.count || 0,
        newsletter_subs: newsletter.count || 0,
        contact_messages: contact.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ─── 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    hint: 'Available: /api/tools, /api/submit-project, /api/prompts, /api/contact, /api/newsletter'
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   Karyaverse API ✦ Running!           ║
  ║   http://localhost:${PORT}               ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}          ║
  ╚═══════════════════════════════════════╝
  `);
});
module.exports = app;
