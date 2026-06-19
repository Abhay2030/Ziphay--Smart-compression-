/* ═══════════════════════════════════════════
   Index Page — CSP-safe bindings
   Replaces all inline script blocks
═══════════════════════════════════════════ */

/* AVIF detection */
if (!document.createElement('canvas').toDataURL('image/avif').startsWith('data:image/avif')) {
    document.querySelectorAll('.fmt-avif').forEach(b => b.style.display = 'none');
}

/* Service Worker Registration */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(reg => console.log('[Ziphay] SW registered:', reg.scope))
            .catch(err => console.warn('[Ziphay] SW registration failed:', err));
    });
}

/* ── CSP-safe event bindings (replaces all inline onclick/oninput) ── */
const _scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
document.getElementById('cmpUploadBtn')?.addEventListener('click', _scrollTop);
document.getElementById('cmpUploadBtn2')?.addEventListener('click', _scrollTop);
document.getElementById('shortcutCloseBtn')?.addEventListener('click', () => {
    if (typeof closeShortcutModal === 'function') closeShortcutModal();
});
document.getElementById('converterLink')?.addEventListener('click', () => window.location.href = '/converter');

/* Mode tabs — Compress / Upscale / Denoise / BG Remove */
document.querySelectorAll('.mode-tab[data-mode]').forEach(tab => {
    tab.addEventListener('click', () => {
        if (typeof switchMode === 'function') switchMode(tab.dataset.mode);
    });
});

/* Denoise strength slider */
document.getElementById('denoiseStrength')?.addEventListener('input', function () {
    document.getElementById('dnVal').textContent = this.value;
});

/* Tool cards — delegated via data attributes */
document.querySelectorAll('.tool-card[data-tool-accept]').forEach(card => {
    card.addEventListener('click', () => {
        if (typeof openTool === 'function') openTool(card.dataset.toolAccept, card.dataset.toolMode);
    });
});

/* Mobile nav — close on anchor click + auth buttons */
document.querySelectorAll('.mnav-anchor').forEach(a => {
    a.addEventListener('click', () => {
        if (typeof closeMobileNav === 'function') closeMobileNav();
    });
});
document.getElementById('mnavLogin')?.addEventListener('click', () => {
    if (window.ZiphayAuthUI) ZiphayAuthUI.open('login');
    if (typeof closeMobileNav === 'function') closeMobileNav();
});
document.getElementById('mnavLogout')?.addEventListener('click', () => {
    if (window.ZiphayAuth) ZiphayAuth.logOut();
    if (typeof closeMobileNav === 'function') closeMobileNav();
});

