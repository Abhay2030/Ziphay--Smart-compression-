/* ═══════════════════════════════════════════════════
   error-boundary.js — Ziphay Error Handling
   
   Handles:
   ✅ CDN script load failures (fflate, FFmpeg, etc.)
   ✅ Uncaught promise rejections
   ✅ Global error handler with toast fallback
   ✅ Offline detection banner
═══════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ── Offline / online detection ── */
  const offlineBanner = document.createElement('div');
  offlineBanner.id = 'ziphay-offline-banner';
  offlineBanner.innerHTML = '⚠️ You are offline. Some features may not work.';
  offlineBanner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99999;
    padding:10px 20px;text-align:center;
    background:linear-gradient(135deg,#f59e0b,#d97706);
    color:#1a0f00;font-size:.85rem;font-weight:700;
    font-family:'Syne',system-ui,sans-serif;
    box-shadow:0 2px 12px rgba(0,0,0,.3);
    transform:translateY(-100%);transition:transform .3s ease;
  `;

  function showOffline() {
    if (!document.getElementById('ziphay-offline-banner')) {
      document.body.appendChild(offlineBanner);
    }
    offlineBanner.style.transform = 'translateY(0)';
  }

  function hideOffline() {
    offlineBanner.style.transform = 'translateY(-100%)';
  }

  window.addEventListener('offline', showOffline);
  window.addEventListener('online', hideOffline);
  if (!navigator.onLine) showOffline();

  /* ── Global error toast ── */
  function showErrorToast(msg) {
    // Use existing showToast if available (from script.js)
    if (typeof window.showToast === 'function') {
      window.showToast('⚠️ ' + msg, 'error');
      return;
    }

    // Fallback: create a simple error toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:99999;padding:14px 24px;border-radius:12px;
      background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);
      color:#f87171;font-size:.85rem;font-weight:600;
      font-family:'Outfit',system-ui,sans-serif;
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      box-shadow:0 8px 32px rgba(0,0,0,.3);max-width:500px;
      animation:zToastIn .3s ease;
    `;
    toast.textContent = '⚠️ ' + msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  /* ── Catch script load failures ── */
  window.addEventListener('error', function(e) {
    // Check if it's a script load error (no line number, target is a script element)
    if (e.target && e.target.tagName === 'SCRIPT' && e.target.src) {
      const scriptName = e.target.src.split('/').pop().split('?')[0];
      console.error('[Ziphay] Failed to load script:', scriptName, e.target.src);
      showErrorToast(`Failed to load ${scriptName}. Check your internet connection and try again.`);
      e.preventDefault();
    }
  }, true); // Use capture phase for resource errors

  /* ── Unhandled promise rejections ── */
  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason?.message || String(e.reason || 'Unknown error');
    // Avoid flooding with Firebase auth errors (handled separately)
    if (msg.includes('auth/') || msg.includes('Firebase')) return;
    console.error('[Ziphay] Unhandled:', msg);
    showErrorToast(msg);
  });

  /* ── CSS animation for toast ── */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes zToastIn {
      from { opacity:0; transform:translateX(-50%) translateY(12px); }
      to   { opacity:1; transform:translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);

  console.log(
    '%c[Ziphay] Error boundary active ✓',
    'background:#f59e0b;color:#1a0f00;padding:2px 8px;border-radius:4px;font-weight:bold'
  );
})();
