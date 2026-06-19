/* ═══════════════════════════════════════════════════
   ZIPHAY  auth-ui.js
   
   Completely self-contained login/signup modal.
   - Wires up nav buttons on DOMContentLoaded
   - Does NOT depend on Firebase loading first
   - Firebase is only used when user submits form
   - Works with file:// and http:// protocols
═══════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────
   MODAL HTML + STYLES  (injected once into body)
───────────────────────────────────────────────── */
const MODAL_STYLES = `
#zp-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  transition: opacity 0.22s ease;
  pointer-events: none;
}
#zp-modal-overlay.zp-visible {
  opacity: 1;
  pointer-events: all;
}
#zp-modal-card {
  background: #0d0d1a;
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 22px;
  width: 100%;
  max-width: 420px;
  padding: 32px;
  margin: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.7);
  transform: translateY(14px);
  transition: transform 0.22s ease;
  position: relative;
}
#zp-modal-overlay.zp-visible #zp-modal-card {
  transform: translateY(0);
}
[data-theme="light"] #zp-modal-card {
  background: #ffffff;
  border-color: rgba(0,0,0,0.1);
}
.zp-close-btn {
  position: absolute;
  top: 14px; right: 16px;
  width: 28px; height: 28px;
  background: transparent;
  border: none;
  color: #6b6b8a;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
  line-height: 1;
  padding: 0;
}
.zp-close-btn:hover { background: rgba(255,255,255,0.08); color: #e8e8f0; }
[data-theme="light"] .zp-close-btn:hover { background: rgba(0,0,0,0.06); color: #0d0d1a; }
.zp-logo {
  display: flex; align-items: center; gap: 9px;
  font-family: 'Syne', sans-serif;
  font-size: 1.2rem; font-weight: 800;
  color: #e8e8f0;
  margin-bottom: 22px;
  letter-spacing: -0.02em;
}
[data-theme="light"] .zp-logo { color: #0d0d1a; }
.zp-logo-icon {
  width: 30px; height: 30px; border-radius: 9px;
  background: linear-gradient(135deg, #00d4aa, #0a8f72);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 14px rgba(0,212,170,0.4);
  flex-shrink: 0;
}
.zp-logo-icon svg { width: 14px; height: 14px; fill: white; }
.zp-logo-dot { color: #00d4aa; }
.zp-tabs {
  display: flex; gap: 4px;
  padding: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  margin-bottom: 20px;
}
[data-theme="light"] .zp-tabs {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.08);
}
.zp-tab {
  flex: 1; padding: 8px;
  border: none; background: transparent;
  color: #6b6b8a;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem; font-weight: 600;
  cursor: pointer; border-radius: 7px;
  transition: background 0.18s, color 0.18s;
}
.zp-tab.zp-active {
  background: #00d4aa;
  color: #07070f;
  box-shadow: 0 0 12px rgba(0,212,170,0.3);
}
.zp-tab:not(.zp-active):hover { color: #e8e8f0; background: rgba(255,255,255,0.06); }
[data-theme="light"] .zp-tab:not(.zp-active) { color: #6b6b8a; }
[data-theme="light"] .zp-tab:not(.zp-active):hover { color: #0d0d1a; background: rgba(0,0,0,0.05); }
.zp-error {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.28);
  color: #f87171;
  font-size: 0.8rem;
  padding: 10px 13px;
  border-radius: 9px;
  margin-bottom: 14px;
  line-height: 1.5;
  display: none;
}
.zp-google-btn {
  width: 100%; padding: 11px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.11);
  color: #e8e8f0;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.875rem; font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
  margin-bottom: 4px;
}
.zp-google-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); }
[data-theme="light"] .zp-google-btn { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.12); color: #0d0d1a; }
[data-theme="light"] .zp-google-btn:hover { background: rgba(0,0,0,0.07); }
.zp-divider {
  display: flex; align-items: center; gap: 12px;
  color: #6b6b8a; font-size: 0.75rem;
  margin: 14px 0;
}
.zp-divider::before, .zp-divider::after {
  content: ''; flex: 1; height: 1px;
  background: rgba(255,255,255,0.07);
}
[data-theme="light"] .zp-divider::before,
[data-theme="light"] .zp-divider::after { background: rgba(0,0,0,0.1); }
.zp-form { display: flex; flex-direction: column; gap: 12px; }
.zp-field { display: flex; flex-direction: column; gap: 5px; }
.zp-field label {
  font-size: 0.7rem; font-weight: 600;
  color: #6b6b8a;
  text-transform: uppercase; letter-spacing: 0.07em;
}
.zp-field input {
  padding: 11px 13px;
  background: rgba(0,0,0,0.28);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  color: #e8e8f0;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  width: 100%;
  box-sizing: border-box;
}
.zp-field input:focus {
  border-color: #00d4aa;
  box-shadow: 0 0 0 3px rgba(0,212,170,0.14);
}
[data-theme="light"] .zp-field input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: #0d0d1a;
}
[data-theme="light"] .zp-field input:focus {
  border-color: #00d4aa;
}
.zp-submit {
  width: 100%; padding: 12px; margin-top: 4px;
  background: #00d4aa; color: #07070f;
  border: none; border-radius: 10px;
  font-family: 'Syne', sans-serif;
  font-size: 0.875rem; font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
  box-shadow: 0 0 20px rgba(0,212,170,0.28);
}
.zp-submit:hover:not(:disabled) {
  box-shadow: 0 0 32px rgba(0,212,170,0.5);
  transform: translateY(-1px);
}
.zp-submit:disabled {
  background: rgba(128,128,200,0.15);
  color: rgba(128,128,200,0.45);
  cursor: wait;
  box-shadow: none; transform: none;
}
.zp-footer-text {
  text-align: center;
  font-size: 0.78rem;
  color: #6b6b8a;
  margin-top: 14px;
}
.zp-link-btn {
  background: transparent; border: none;
  color: #00d4aa; cursor: pointer;
  font-size: 0.78rem; font-weight: 600;
  font-family: 'Outfit', sans-serif;
  padding: 0;
}
.zp-link-btn:hover { text-decoration: underline; }
.zp-tos { font-size: 0.74rem; color: #6b6b8a; text-align: center; margin-top: 10px; }
.zp-tos a { color: #00d4aa; text-decoration: none; }
.zp-tos a:hover { text-decoration: underline; }
.zp-hidden { display: none !important; }
`;

function buildModalHTML() {
  const googleIcon = `<svg viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;

  return `
  <div id="zp-modal-overlay">
    <div id="zp-modal-card">

      <button class="zp-close-btn" id="zpClose">✕</button>

      <div class="zp-logo">
        <div class="zp-logo-icon">
          <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11L9 22L19.5 10H13Z"/></svg>
        </div>
        Ziphay<span class="zp-logo-dot">.</span>
      </div>

      <div class="zp-tabs">
        <button class="zp-tab zp-active" id="zpTabLogin">Sign In</button>
        <button class="zp-tab" id="zpTabSignup">Create Account</button>
      </div>

      <div class="zp-error" id="zpError"></div>

      <!-- ── LOGIN PANEL ── -->
      <div id="zpPanelLogin">
        <button class="zp-google-btn" id="zpGoogleLogin">${googleIcon} Continue with Google</button>
        <div class="zp-divider">or</div>
        <form class="zp-form" id="zpFormLogin" autocomplete="on">
          <div class="zp-field">
            <label>Email</label>
            <input type="email" id="zpLoginEmail" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="zp-field">
            <label>Password</label>
            <input type="password" id="zpLoginPass" placeholder="Your password" required autocomplete="current-password" minlength="6">
          </div>
          <button type="submit" class="zp-submit" id="zpLoginSubmit">Sign In →</button>
        </form>
        <p class="zp-footer-text">
          No account?
          <button class="zp-link-btn" id="zpSwitchToSignup">Create one free</button>
        </p>
      </div>

      <!-- ── SIGNUP PANEL ── -->
      <div id="zpPanelSignup" class="zp-hidden">
        <button class="zp-google-btn" id="zpGoogleSignup">${googleIcon} Sign up with Google</button>
        <div class="zp-divider">or</div>
        <form class="zp-form" id="zpFormSignup" autocomplete="on">
          <div class="zp-field">
            <label>Your Name</label>
            <input type="text" id="zpSignupName" placeholder="e.g. Abhay Donde" required autocomplete="name">
          </div>
          <div class="zp-field">
            <label>Email</label>
            <input type="email" id="zpSignupEmail" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="zp-field">
            <label>Password <span style="font-weight:400;text-transform:none;letter-spacing:0">(min 6 chars)</span></label>
            <input type="password" id="zpSignupPass" placeholder="Choose a strong password" required autocomplete="new-password" minlength="6">
          </div>
          <button type="submit" class="zp-submit" id="zpSignupSubmit">Create Account →</button>
        </form>
        <p class="zp-footer-text">
          Already have an account?
          <button class="zp-link-btn" id="zpSwitchToLogin">Sign in</button>
        </p>
        <p class="zp-tos">
          By signing up you agree to our
          <a href="/terms">Terms</a> &amp;
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>

    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────
   INJECT styles + HTML into page
───────────────────────────────────────────────── */
function inject() {
  if (document.getElementById('zp-modal-overlay')) return; // already injected

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.id = 'zp-modal-styles';
  styleEl.textContent = MODAL_STYLES;
  document.head.appendChild(styleEl);

  // Inject HTML
  const div = document.createElement('div');
  div.innerHTML = buildModalHTML();
  document.body.appendChild(div.firstElementChild);

  wireModalEvents();
}

/* ─────────────────────────────────────────────────
   OPEN / CLOSE
───────────────────────────────────────────────── */
function openModal(tab) {
  inject();
  const overlay = document.getElementById('zp-modal-overlay');
  overlay.classList.add('zp-visible');
  switchTab(tab || 'login');
  clearError();
  // Focus first visible input after animation
  setTimeout(() => {
    const firstInput = overlay.querySelector('input:not([type=hidden])');
    if (firstInput) firstInput.focus();
  }, 120);
}

function closeModal() {
  const overlay = document.getElementById('zp-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('zp-visible');
}

/* ─────────────────────────────────────────────────
   TAB SWITCH
───────────────────────────────────────────────── */
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('zpTabLogin').classList.toggle('zp-active', isLogin);
  document.getElementById('zpTabSignup').classList.toggle('zp-active', !isLogin);
  document.getElementById('zpPanelLogin').classList.toggle('zp-hidden', !isLogin);
  document.getElementById('zpPanelSignup').classList.toggle('zp-hidden', isLogin);
  clearError();
}

/* ─────────────────────────────────────────────────
   ERROR DISPLAY
───────────────────────────────────────────────── */
function showError(msg) {
  const el = document.getElementById('zpError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function clearError() {
  const el = document.getElementById('zpError');
  if (el) el.style.display = 'none';
}

/* ─────────────────────────────────────────────────
   FRIENDLY FIREBASE ERROR MESSAGES
───────────────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'That email is already registered. Try signing in.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user': 'Popup closed. Please try again.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ─────────────────────────────────────────────────
   SET BUTTON LOADING STATE
───────────────────────────────────────────────── */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Please wait…';
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

/* ─────────────────────────────────────────────────
   AUTH HANDLERS
   All Firebase calls are guarded — if ZiphayAuth
   isn't loaded yet, shows a helpful message.
───────────────────────────────────────────────── */
function getAuth() {
  if (window.ZiphayAuth) return window.ZiphayAuth;
  // Firebase module hasn't loaded yet — retry after delay
  return null;
}

async function handleGoogleSignIn() {
  clearError();
  const auth = getAuth();
  if (!auth) {
    showError('Auth service loading… please try again in a moment.');
    return;
  }
  try {
    await auth.signInWithGoogle();
    closeModal();
    showToast('Signed in with Google ✓');
  } catch (e) {
    showError(friendlyError(e.code));
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearError();
  const auth = getAuth();
  if (!auth) { showError('Auth service loading… please try again.'); return; }

  setLoading('zpLoginSubmit', true);
  try {
    await auth.signIn(
      document.getElementById('zpLoginEmail').value.trim(),
      document.getElementById('zpLoginPass').value
    );
    closeModal();
    showToast('Welcome back ✓');
  } catch (e) {
    showError(friendlyError(e.code));
  } finally {
    setLoading('zpLoginSubmit', false);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  clearError();
  const auth = getAuth();
  if (!auth) { showError('Auth service loading… please try again.'); return; }

  setLoading('zpSignupSubmit', true);
  try {
    await auth.signUp(
      document.getElementById('zpSignupEmail').value.trim(),
      document.getElementById('zpSignupPass').value,
      document.getElementById('zpSignupName').value.trim()
    );
    closeModal();
    showToast('Account created! Welcome to Ziphay ✓');
  } catch (e) {
    showError(friendlyError(e.code));
  } finally {
    setLoading('zpSignupSubmit', false);
  }
}

/* ─────────────────────────────────────────────────
   WIRE UP MODAL INTERNAL EVENTS
───────────────────────────────────────────────── */
function wireModalEvents() {
  // Close
  document.getElementById('zpClose').addEventListener('click', closeModal);
  document.getElementById('zp-modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Tab switching
  document.getElementById('zpTabLogin').addEventListener('click', () => switchTab('login'));
  document.getElementById('zpTabSignup').addEventListener('click', () => switchTab('signup'));
  document.getElementById('zpSwitchToSignup').addEventListener('click', () => switchTab('signup'));
  document.getElementById('zpSwitchToLogin').addEventListener('click', () => switchTab('login'));

  // Google buttons
  document.getElementById('zpGoogleLogin').addEventListener('click', handleGoogleSignIn);
  document.getElementById('zpGoogleSignup').addEventListener('click', handleGoogleSignIn);

  // Forms
  document.getElementById('zpFormLogin').addEventListener('submit', handleLogin);
  document.getElementById('zpFormSignup').addEventListener('submit', handleSignup);

  // Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
}

/* ─────────────────────────────────────────────────
   SUCCESS TOAST
───────────────────────────────────────────────── */
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = [
    'position:fixed', 'bottom:28px', 'left:50%',
    'transform:translateX(-50%) translateY(12px)',
    'background:#00d4aa', 'color:#07070f',
    'padding:10px 22px', 'border-radius:100px',
    'font-family:Syne,sans-serif', 'font-size:.85rem',
    'font-weight:700', 'z-index:999999',
    'opacity:0', 'transition:all .3s',
    'white-space:nowrap',
    'box-shadow:0 6px 28px rgba(0,212,170,.45)',
    'pointer-events:none'
  ].join(';');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
  });
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(12px)';
    setTimeout(() => t.remove(), 350);
  }, 3200);
}

/* ─────────────────────────────────────────────────
   WIRE UP NAV BUTTONS (on DOMContentLoaded)
   Attaches click handlers to every auth-related
   button on the page — no onclick="" needed in HTML
───────────────────────────────────────────────── */
function wireNavButtons() {
  // Sign In button
  const loginBtn = document.getElementById('navLoginBtn');
  if (loginBtn) {
    loginBtn.style.cursor = 'pointer';
    loginBtn.addEventListener('click', () => openModal('login'));
  }

  // Sign Out button
  const logoutBtn = document.getElementById('navLogoutBtn');
  if (logoutBtn) {
    logoutBtn.style.cursor = 'pointer';
    logoutBtn.addEventListener('click', async () => {
      const auth = getAuth();
      if (auth) await auth.logOut();
    });
  }

  // "Get Pro" nav button → opens signup
  const ctaBtn = document.querySelector('.nav-cta');
  if (ctaBtn && !ctaBtn.hasAttribute('data-zp-wired')) {
    ctaBtn.setAttribute('data-zp-wired', '1');
    ctaBtn.addEventListener('click', () => openModal('signup'));
  }

  // Any other buttons on the page that trigger auth
  // (e.g. auth-gate buttons on /dashboard)
  document.querySelectorAll('[data-zp-open]').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.zpOpen || 'login'));
  });
}

/* ─────────────────────────────────────────────────
   INIT — run as soon as DOM is ready
───────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireNavButtons);
} else {
  // DOM already loaded (script is deferred or at bottom)
  wireNavButtons();
}

/* ─────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────── */
window.ZiphayAuthUI = {
  open: openModal,
  close: closeModal,
  showToast,
};
