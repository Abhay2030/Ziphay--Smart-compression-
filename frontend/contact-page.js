/* ═══════════════════════════════════════════
   Contact Page — CSP-safe form handler
═══════════════════════════════════════════ */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      this.style.display = 'none';
      document.getElementById('formSuccess').classList.add('show');
    });
  }
})();

