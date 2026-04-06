# Karyaverse — Complete Deployment Guide
## Frontend (Netlify) + Backend (Vercel) + Database (Supabase)

---

## ✅ YOUR PROJECT STATUS
- Supabase project: wimcnsqtezayizdbghla.supabase.co (CREATED ✓)
- Backend: server.js ready (Express + Supabase)
- Frontend: 8 HTML pages ready
- Missing: Supabase tables not yet created, Vercel not deployed, CORS not updated

---

## STEP 1 — SET UP SUPABASE DATABASE (5 minutes)

1. Go to https://supabase.com and log in
2. Open your project: wimcnsqtezayizdbghla
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy the ENTIRE contents of `backend/database.sql`
6. Paste it and click "Run" (green button)
7. You should see "Success. No rows returned"

That creates all 5 tables: tools, submissions, prompts, newsletter, contact_messages

---

## STEP 2 — DEPLOY BACKEND TO VERCEL (10 minutes)

### 2a. Push backend to GitHub
Open terminal on your computer in the `backend/` folder:

```
git init
git add .
git commit -m "Karyaverse backend ready"
```

Go to github.com → New Repository → Name: `karyaverse-backend` → Create
Then run:
```
git remote add origin https://github.com/YOUR_USERNAME/karyaverse-backend.git
git push -u origin main
```

### 2b. Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Select your `karyaverse-backend` repo
4. Click "Deploy" (don't change settings)
5. Wait ~1 minute for build

### 2c. Add Environment Variables in Vercel
After deploy, go to: Project → Settings → Environment Variables
Add these one by one:

| Key | Value |
|-----|-------|
| SUPABASE_URL | https://wimcnsqtezayizdbghla.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGci...nmdyadMTULokX7cOJfX5iS-YqiohYamsWJZtTjOjtG8 |
| SUPABASE_SERVICE_KEY | eyJhbGci...SsT2yZ-U_rHKFsbv0TXcIBUgUR92E-UQT0avhIkVeio |
| ADMIN_SECRET | karyaverse-kartiki-secret-2024 |
| NODE_ENV | production |
| ALLOWED_ORIGINS | https://karyaverse.netlify.app |

### 2d. Get your Vercel URL
Go to: Project → Deployments → copy the URL
It looks like: `https://karyaverse-backend.vercel.app`

### 2e. Redeploy after adding env vars
Go to: Deployments → ... → Redeploy

---

## STEP 3 — UPDATE FRONTEND API URL (2 minutes)

Open `frontend/main.js` and at the TOP of the file add:
```js
const API_URL = 'https://karyaverse-backend.vercel.app'; // your Vercel URL
```

Open `frontend/lab.html` and find the line:
```js
const API_URL = 'http://localhost:3000';
```
Change it to:
```js
const API_URL = 'https://karyaverse-backend.vercel.app';
```

---

## STEP 4 — DEPLOY FRONTEND TO NETLIFY (5 minutes)

1. Go to https://netlify.com and sign up free
2. Click "Add new site" → "Deploy manually"
3. Drag and drop your entire `frontend/` folder onto the page
4. Wait 30 seconds
5. Your site is live at something like: https://karyaverse.netlify.app

### Optional: Custom domain
- Netlify → Site settings → Domain management → Add custom domain
- Type: karyaverse.com (or whatever you buy)
- SSL/HTTPS is automatic and free

---

## STEP 5 — UPDATE CORS ON VERCEL (2 minutes)

Now that you have your Netlify URL, go back to Vercel:
Project → Settings → Environment Variables → Edit ALLOWED_ORIGINS
Change to: `https://karyaverse.netlify.app`
(Replace with your actual Netlify URL)

Redeploy again from Vercel Deployments tab.

---

## STEP 6 — TEST EVERYTHING (5 minutes)

Open your Netlify URL and test:
1. Visit homepage — should load fine
2. Visit marketplace — tools should load from database
3. Submit a project on lab.html — should save to Supabase
4. Go to lab.html#admin-panel — should show the submission
5. Mark as winner — should appear in Featured Projects
6. Refresh page — winner should STILL be there (stored in Supabase now!)

Test your backend API directly:
- https://your-backend.vercel.app → should show {"status":"ok"}
- https://your-backend.vercel.app/api/tools → should show tools JSON

---

## SECURITY CHECKLIST

✅ CORS locked to your Netlify domain only
✅ Rate limiting: 100 req/15min general, 5 submissions/hour
✅ Admin routes protected by x-admin-secret header
✅ Input sanitization on all form fields
✅ Security headers via netlify.toml (X-Frame-Options, CSP, etc.)
✅ .env file NOT pushed to GitHub (in .gitignore)
✅ Supabase RLS (Row Level Security) enabled

---

## ADMIN PANEL

URL: https://karyaverse.netlify.app/lab.html#admin-panel

What you can do:
- See all project submissions with student name, email, school
- Click "View Project" to open their GitHub/demo link
- Mark as Winner → instantly shows in Featured Projects
- Export CSV of all submissions
- Delete spam entries

---

## TROUBLESHOOTING

**Backend returns 500 error:**
- Check Vercel → Functions → Logs for error
- Usually means env variables not set correctly

**CORS error in browser:**
- Go to Vercel → env vars → ALLOWED_ORIGINS = your exact Netlify URL
- Redeploy

**Submissions not saving:**
- Run database.sql in Supabase SQL Editor first
- Check Supabase → Table Editor → submissions table exists

**Winners not showing after refresh:**
- This is now fixed — data saves to Supabase (not localStorage)
- Refresh should work correctly after Supabase is connected

---

## ARCHITECTURE SUMMARY

```
User visits Netlify URL
       ↓
Frontend (HTML/CSS/JS)     ← Hosted on Netlify (free)
       ↓ API calls
Backend (Express.js)       ← Hosted on Vercel (free)
       ↓ Database queries
Supabase (PostgreSQL)      ← Database (free tier)
```

Total cost: ₹0/month for small-medium traffic
