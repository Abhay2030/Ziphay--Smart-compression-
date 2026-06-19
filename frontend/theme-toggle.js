/* ═══════════════════════════════════════════
   Ziphay — Shared Theme Toggle
   CSP-safe: no inline scripts needed
═══════════════════════════════════════════ */
(function () {
  'use strict';
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const h = document.documentElement;
    const d = h.getAttribute('data-theme') === 'dark';
    h.setAttribute('data-theme', d ? 'light' : 'dark');
    this.textContent = d ? '☀️' : '🌙';
  });
})();

