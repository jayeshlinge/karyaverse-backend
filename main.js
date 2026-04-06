// =============================================
// KARYAVERSE MAIN JS — with live API support
// =============================================

// CRITICAL: Apply theme BEFORE anything renders (prevents FOUC)
(function () {
  const saved = localStorage.getItem('kv-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.documentElement.classList.add('ready');
})();

// ─── API Configuration ─────────────────────────────────────────────────────
// Change this to your Railway URL after deployment:
// const API = 'https://karyaverse-backend.up.railway.app';
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://karyaverse-backend.up.railway.app'; // <-- update after deploy

// ─── Generic fetch helper with error handling ──────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  } catch (err) {
    console.error('[API Error]', path, err.message);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {

  const html = document.documentElement;

  // ─── Apply icon for saved theme ───────────────────────────────────────
  const themeIcon = document.getElementById('themeIcon');
  const savedTheme = html.getAttribute('data-theme') || 'dark';
  if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

  // Enable CSS transitions after first paint (prevents colour flash on load)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('theme-ready');
  }));

  // ─── Theme toggle ──────────────────────────────────────────────────────
  const themeToggle = document.getElementById('themeToggle');
  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('kv-theme', theme);
    if (themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  // ─── Navbar scroll ─────────────────────────────────────────────────────
  const navbar = document.getElementById('navbar');
  function updateNavbar() {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  // ─── Hamburger mobile menu ─────────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    mobileMenu.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => mobileMenu.classList.remove('open'))
    );
  }

  // ─── Fade-in on scroll ─────────────────────────────────────────────────
  const faders = document.querySelectorAll('.fade-in');
  if (faders.length > 0) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    faders.forEach(f => obs.observe(f));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MARKETPLACE — load tools from backend
  // ═══════════════════════════════════════════════════════════════════════
  const toolsGrid = document.getElementById('toolsGrid');
  if (toolsGrid) {
    loadTools();
  }

  async function loadTools(filters = {}) {
    toolsGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text2)">
        <i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:16px;display:block"></i>
        Loading tools...
      </div>`;

    try {
      const params = new URLSearchParams(filters).toString();
      const data = await apiFetch('/api/tools' + (params ? '?' + params : ''));
      renderTools(data.tools || []);
    } catch (err) {
      // Fallback: show static tools if API is unavailable
      toolsGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">
          <i class="fas fa-wifi" style="font-size:2rem;margin-bottom:12px;display:block;opacity:.4"></i>
          <p>Could not connect to the API. Showing cached tools.</p>
          <p style="font-size:.8rem;margin-top:8px;opacity:.6">Start your backend server and refresh.</p>
        </div>`;
    }
  }

  function renderTools(tools) {
    if (!tools.length) {
      toolsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">No tools found.</div>`;
      return;
    }

    toolsGrid.innerHTML = tools.map(tool => {
      const affiliateUrl = tool.affiliate_url || tool.url;
      return `
        <div class="tool-card fade-in" data-cat="${escHtml(tool.category)}" data-access="${escHtml(tool.access_type)}">
          ${tool.is_featured ? `<div class="verified-badge" style="background:linear-gradient(135deg,#f59e0b,#f97316)"><i class="fas fa-star"></i> Featured</div>` : ''}
          ${tool.is_verified && !tool.is_featured ? `<div class="verified-badge"><i class="fas fa-check-circle"></i> Verified</div>` : ''}
          <div class="tool-card-header">
            <div class="tool-icon" style="background:rgba(99,102,241,.1);color:${escHtml(tool.icon_color || '#6366f1')}">
              <i class="${escHtml(tool.icon || 'fas fa-robot')}"></i>
            </div>
            <div class="tool-info">
              <div class="tool-name">${escHtml(tool.name)}</div>
              <div class="tool-category">${escHtml(tool.category)}</div>
            </div>
          </div>
          <p class="tool-desc">${escHtml(tool.description || '')}</p>
          <div class="tool-footer">
            <div class="tool-tags">
              ${(tool.tags || []).slice(0, 2).map(t => `<span class="tool-tag">${escHtml(t)}</span>`).join('')}
            </div>
            <span class="tool-access access-${escHtml(tool.access_type)}">${escHtml(tool.access_type)}</span>
          </div>
          <a href="${escHtml(affiliateUrl)}" target="_blank" rel="noopener"
             class="tool-link" onclick="trackClick('${escHtml(tool.id)}')">
            <i class="fas fa-external-link-alt"></i> Visit Tool
          </a>
        </div>`;
    }).join('');

    // Re-observe new fade-in elements
    document.querySelectorAll('.tool-card.fade-in:not(.visible)').forEach(f => {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.05 });
      obs.observe(f);
    });
  }

  // Track affiliate link click
  window.trackClick = function (toolId) {
    apiFetch('/api/tools/click', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId })
    }).catch(() => {}); // silent fail
  };

  // ─── Search ────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('toolSearch');
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = e.target.value.trim();
        if (q.length > 1) loadTools({ search: q });
        else if (q.length === 0) loadTools();
      }, 300);
    });
  }

  // ─── Category filter buttons ───────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      loadTools(cat && cat !== 'all' ? { category: cat } : {});
    });
  });

  // ─── Access filter buttons ─────────────────────────────────────────────
  document.querySelectorAll('.access-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.access-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const acc = btn.dataset.access;
      loadTools(acc && acc !== 'all' ? { access: acc } : {});
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PROMPTS PAGE — load from backend
  // ═══════════════════════════════════════════════════════════════════════
  const promptsGrid = document.querySelector('.prompts-grid');
  if (promptsGrid) {
    loadPrompts();
  }

  async function loadPrompts(category = 'all') {
    promptsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)"><i class="fas fa-spinner fa-spin"></i> Loading prompts...</div>`;
    try {
      const params = category && category !== 'all' ? `?category=${category}` : '';
      const data = await apiFetch('/api/prompts' + params);
      renderPrompts(data.prompts || []);
    } catch (err) {
      promptsGrid.innerHTML = `<div style="grid-column:1/-1;color:var(--text2);text-align:center;padding:40px">Could not load prompts from server.</div>`;
    }
  }

  function renderPrompts(prompts) {
    if (!prompts.length) {
      promptsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:40px">No prompts found.</div>`;
      return;
    }
    promptsGrid.innerHTML = prompts.map(p => `
      <div class="prompt-card fade-in" data-cat="${escHtml(p.category)}">
        <div class="prompt-type">${escHtml(p.type || p.category)}</div>
        <div class="prompt-title">${escHtml(p.title)}</div>
        <div class="prompt-text" id="pt-${escHtml(p.id)}">${escHtml(p.prompt_text)}</div>
        <button class="copy-btn" onclick="copyPrompt('${escHtml(p.id)}', this)">
          <i class="fas fa-copy"></i> Copy Prompt
        </button>
      </div>`).join('');
  }

  // Copy prompt to clipboard + track
  window.copyPrompt = function (promptId, btn) {
    const textEl = document.getElementById('pt-' + promptId);
    if (!textEl) return;
    navigator.clipboard.writeText(textEl.textContent.trim()).then(() => {
      const orig = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
    });
    // Track copy analytics
    apiFetch('/api/prompts/copy', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId })
    }).catch(() => {});
  };

  // Legacy copy-btn support (static HTML prompts)
  document.querySelectorAll('.copy-btn:not([onclick])').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.closest('.prompt-card')?.querySelector('.prompt-text')?.textContent || '';
      navigator.clipboard.writeText(text.trim()).then(() => {
        const orig = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
      });
    });
  });

  // Prompts filter buttons
  document.querySelectorAll('.filter-btn[data-cat]').forEach(btn => {
    if (!toolsGrid) { // only on prompts page
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPrompts(btn.dataset.cat);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INNOVATION LAB — project submission form
  // ═══════════════════════════════════════════════════════════════════════
  const projectForm = document.getElementById('projectForm');
  if (projectForm) {
    // Load winners from backend
    loadWinners();

    projectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = projectForm.querySelector('button[type="submit"]');
      const orig = btn.innerHTML;

      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      btn.disabled = true;

      try {
        const formData = new FormData(projectForm);
        const payload = Object.fromEntries(formData.entries());

        const data = await apiFetch('/api/submit-project', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        btn.innerHTML = '<i class="fas fa-check"></i> Submitted! We will review your project.';
        btn.style.background = 'var(--green)';
        projectForm.reset();

        // Show success message
        showToast('Your project has been submitted! Kartiki will review it soon.', 'success');
      } catch (err) {
        btn.innerHTML = orig;
        btn.disabled = false;
        showToast(err.message || 'Submission failed. Please try again.', 'error');
      }
    });
  }

  async function loadWinners() {
    const winnersGrid = document.querySelector('.winners-grid');
    if (!winnersGrid) return;
    try {
      const data = await apiFetch('/api/submissions/winners');
      if (data.winners && data.winners.length > 0) {
        winnersGrid.innerHTML = data.winners.map(w => `
          <div class="tool-card fade-in">
            <div class="verified-badge" style="background:linear-gradient(135deg,#f59e0b,#f97316)">
              <i class="fas fa-trophy"></i> Winner
            </div>
            <div class="tool-card-header">
              <div class="tool-icon" style="background:rgba(16,185,129,.1);color:#10b981">
                <i class="fas fa-flask"></i>
              </div>
              <div class="tool-info">
                <div class="tool-name">${escHtml(w.project)}</div>
                <div class="tool-category">${escHtml(w.category || 'Innovation')} · ${escHtml(w.school || '')}</div>
              </div>
            </div>
            <p class="tool-desc">${escHtml(w.description)}</p>
            <div class="tool-footer">
              <div class="tool-tags"><span class="tool-tag">${escHtml(w.category || '')}</span></div>
              <span class="tool-access access-free">Winner</span>
            </div>
            ${w.demo_url ? `<a href="${escHtml(w.demo_url)}" target="_blank" class="tool-link"><i class="fas fa-external-link-alt"></i> View Project</a>` : ''}
          </div>`).join('');
      }
    } catch (err) {
      console.log('[Winners] Could not load from API, using static content.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NEWSLETTER SIGNUP
  // ═══════════════════════════════════════════════════════════════════════
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('input[type="email"]')?.value;
      const btn = newsletterForm.querySelector('button');
      if (!email) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      try {
        await apiFetch('/api/newsletter', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        showToast('Subscribed! You will get the latest AI news from Karyaverse.', 'success');
        newsletterForm.reset();
      } catch (err) {
        showToast('Signup failed. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Subscribe';
      }
    });
  }

  // ─── Toast notification ────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('kv-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kv-toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      background:${type === 'success' ? 'var(--green)' : '#ef4444'};
      color:#fff;padding:14px 20px;border-radius:12px;
      font-size:.9rem;font-weight:600;max-width:340px;
      box-shadow:0 4px 20px rgba(0,0,0,.3);
      animation:slideUp .3s ease;
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = '@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);

    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
  }

  // ─── Utility: escape HTML to prevent XSS ──────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── URL param filter (marketplace page load) ──────────────────────────
  const activeCat = new URLSearchParams(window.location.search).get('cat');
  if (activeCat && toolsGrid) {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === activeCat);
    });
    loadTools({ category: activeCat });
  }

});
