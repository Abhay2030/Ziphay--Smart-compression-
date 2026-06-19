/* ═══════════════════════════════════════════
   DASHBOARD PAGE — JavaScript Engine (CSP-safe)
   All event handlers use addEventListener —
   no inline onclick attributes.
═══════════════════════════════════════════ */
'use strict';

let allRecords = [];
let activeFilter = 'all';

/* ── Bind all interactive elements (no inline onclick) ── */
document.getElementById('navLogoutBtn')?.addEventListener('click', () => handleLogout());
document.getElementById('navLoginBtn')?.addEventListener('click', () => { if(window.ZiphayAuthUI) ZiphayAuthUI.open('login'); });
document.getElementById('gateSignIn')?.addEventListener('click', () => { if(window.ZiphayAuthUI) ZiphayAuthUI.open('login'); });
document.getElementById('gateSignUp')?.addEventListener('click', () => { if(window.ZiphayAuthUI) ZiphayAuthUI.open('signup'); });
document.getElementById('tabHistory')?.addEventListener('click', () => switchDashTab('history'));
document.getElementById('tabProfile')?.addEventListener('click', () => switchDashTab('profile'));
document.getElementById('histSearch')?.addEventListener('input', () => filterHistory());
document.querySelectorAll('.hf-btn').forEach(b => b.addEventListener('click', () => setFilter(b)));
document.getElementById('btnUpgradePro')?.addEventListener('click', () => upgradeUserPlan());

/* ── Auth state wiring ── */
function waitForAuth(cb) {
  /* Poll until ZiphayAuth is ready (module loads async) */
  if (window.ZiphayAuth) { cb(); return; }
  setTimeout(() => waitForAuth(cb), 80);
}

waitForAuth(() => {
  ZiphayAuth.onLogin(user => showDashboard(user));
  ZiphayAuth.onLogout(() => showAuthGate());
  /* If page loads while already logged in — handled by onAuthStateChanged in auth.js */
  setTimeout(() => {
    const u = ZiphayAuth.currentUser();
    if (u) showDashboard(u);
    else showAuthGate();
  }, 600);
});

/* ── Show/hide states ── */
function showAuthGate() {
  document.getElementById('authGate').style.display = 'block';
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('dashContent').style.display = 'none';
}
function showLoading() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('dashContent').style.display = 'none';
}

async function showDashboard(user) {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('dashContent').style.display = 'block';

  /* User header — SECURITY: Safe avatar rendering (no innerHTML with user data) */
  const avatar = document.getElementById('dashAvatar');
  if (user.photoURL) {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    img.onerror = () => { img.remove(); avatar.textContent = (user.displayName || user.email)[0].toUpperCase(); };
    avatar.textContent = ''; /* clear safely */
    avatar.appendChild(img);
  } else {
    avatar.textContent = (user.displayName || user.email)[0].toUpperCase();
  }
  document.getElementById('dashUserName').textContent = user.displayName || 'Ziphay User';
  document.getElementById('dashUserEmail').textContent = user.email;

  /* Load stats + history */
  try {
    const [stats, history] = await Promise.all([
      ZiphayAuth.getStats(),
      ZiphayAuth.getHistory(100)
    ]);
    renderStats(stats);
    allRecords = history;
    renderTable(history);

    /* Load Plan */
    const profile = await ZiphayAuth.getUserProfile();
    /* All features unlocked for all users */
    const pBadge = document.getElementById('planBadge');
    pBadge.textContent = 'Pro Plan ✨';
    pBadge.style.background = 'rgba(139,92,246,.1)';
    pBadge.style.color = 'var(--purple)';

    document.getElementById('proUpgradeBox').style.display = 'none';
    document.getElementById('proActiveBox').style.display = 'block';

  } catch (e) {
    console.error('[Dashboard]', e);
  }
}

function switchDashTab(tab) {
  document.getElementById('tabHistory').classList.toggle('active', tab === 'history');
  document.getElementById('tabProfile').classList.toggle('active', tab === 'profile');
  document.getElementById('viewHistory').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('viewProfile').style.display = tab === 'profile' ? 'block' : 'none';
}

async function upgradeUserPlan() {
  const btn = document.getElementById('btnUpgradePro');
  btn.textContent = 'Processing...';
  try {
    await ZiphayAuth.upgradeToPro();
    btn.textContent = 'Success!';
    const pBadge = document.getElementById('planBadge');
    pBadge.textContent = 'Pro Plan ✨';
    pBadge.style.background = 'rgba(139,92,246,.1)';
    pBadge.style.color = 'var(--purple)';
    document.getElementById('proUpgradeBox').style.display = 'none';
    document.getElementById('proActiveBox').style.display = 'block';
  } catch (e) {
    alert('Upgrade failed: ' + e.message);
    btn.textContent = 'Upgrade to Pro — $9/mo';
  }
}

function renderStats(s) {
  document.getElementById('statTotal').textContent = s.totalFiles;
  document.getElementById('statSaved').textContent = fmtBytes(s.totalSavedBytes);
  document.getElementById('statCompress').textContent = s.compressions;
  document.getElementById('statUpscale').textContent = s.upscales;
  document.getElementById('statAvg').textContent = s.totalFiles ? s.avgSaved + '%' : '—';
}

function renderTable(records) {
  const tbody = document.getElementById('histTbody');
  const empty = document.getElementById('emptyState');
  const wrap = document.getElementById('histTableWrap');
  const noRes = document.getElementById('noResults');

  if (!records.length && !document.getElementById('histSearch').value) {
    empty.style.display = 'block';
    wrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display = 'block';

  if (!records.length) {
    tbody.innerHTML = '';
    noRes.style.display = 'block';
    return;
  }
  noRes.style.display = 'none';

  /* SECURITY: All user data is escaped via escHtml(). Delete buttons use
     data-id attributes + event delegation to prevent XSS from record IDs. */
  tbody.innerHTML = records.map(r => {
    const icon = fileIcon(r.filename);
    const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
    const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const isUp = r.mode === 'upscale';
    const diffNum = isUp
      ? `+${Math.round(Math.max(0, (r.newSize / r.origSize - 1) * 100))}%`
      : `${r.savedPct || 0}%`;
    const diffCls = isUp ? 'saved-neg' : 'saved-pos';
    /* Sanitize mode to whitelist to prevent injection */
    const safeMode = ['compress','upscale','denoise','bgremove'].includes(r.mode) ? r.mode : 'compress';
    const safeGoal = ['web','email','social','archive','auto'].includes(r.goal) ? r.goal : 'web';
    const safeScale = [2,4,8].includes(Number(r.scale)) ? r.scale : '2';

    return `
      <tr data-mode="${safeMode}" data-name="${escHtml((r.filename || '').toLowerCase())}">
        <td>
          <div class="file-cell">
            <div class="file-icon ${icon.cls}">${icon.emoji}</div>
            <div>
              <div class="file-name">${escHtml(r.filename || 'Unknown')}</div>
              <div class="file-meta">${escHtml(r.outputName || '')}</div>
            </div>
          </div>
        </td>
        <td><span class="mode-badge ${isUp ? 'mb-upscale' : 'mb-compress'}">${escHtml(safeMode)}</span></td>
        <td style="color:var(--muted);font-size:.8rem">${isUp ? escHtml(String(safeScale)) + '×' : escHtml(safeGoal)}</td>
        <td>
          <span style="color:var(--muted);font-size:.8rem">${fmtBytes(r.origSize || 0)}</span>
          <span class="size-arrow"> → </span>
          <span style="font-size:.8rem">${fmtBytes(r.newSize || 0)}</span>
        </td>
        <td><span class="saved-pct ${diffCls}">${diffNum}</span></td>
        <td style="color:var(--muted);font-size:.78rem;white-space:nowrap">${escHtml(dateStr)}</td>
        <td>
          <button class="del-btn" data-record-id="${escHtml(r.id)}" title="Delete record">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  /* Event delegation for delete buttons — prevents XSS from record IDs */
  tbody.querySelectorAll('.del-btn[data-record-id]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.recordId));
  });
}

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return { cls: 'fi-img', emoji: '🖼️' };
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return { cls: 'fi-vid', emoji: '🎬' };
  if (ext === 'pdf') return { cls: 'fi-doc', emoji: '📄' };
  if (['zip', 'gz', 'rar', '7z'].includes(ext)) return { cls: 'fi-zip', emoji: '📦' };
  if (['doc', 'docx'].includes(ext)) return { cls: 'fi-doc', emoji: '📝' };
  return { cls: 'fi-up', emoji: '📁' };
}

function filterHistory() {
  const q = document.getElementById('histSearch').value.toLowerCase();
  const filtered = allRecords.filter(r => {
    const modeMatch = activeFilter === 'all' || r.mode === activeFilter;
    const nameMatch = !q || (r.filename || '').toLowerCase().includes(q);
    return modeMatch && nameMatch;
  });
  renderTable(filtered);
}

function setFilter(btn) {
  document.querySelectorAll('.hf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  filterHistory();
}

async function confirmDelete(id) {
  if (!confirm('Remove this record from your history?')) return;
  try {
    await ZiphayAuth.deleteRecord(id);
    allRecords = allRecords.filter(r => r.id !== id);
    filterHistory();
    /* Refresh stats */
    const stats = await ZiphayAuth.getStats();
    renderStats(stats);
  } catch (e) {
    alert('Could not delete record: ' + e.message);
  }
}

async function handleLogout() {
  await ZiphayAuth.logOut();
  showAuthGate();
}

/* ── Utils ── */
function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</, '&lt;').replace(/>/, '&gt;');
}

/* ── Theme toggle ── */
const tb = document.getElementById('themeBtn');
if (tb) {
  const savedTheme = localStorage.getItem('ziphay_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  tb.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  tb.addEventListener('click', function () {
    const h = document.documentElement;
    const isDark = h.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    h.setAttribute('data-theme', newTheme);
    localStorage.setItem('ziphay_theme', newTheme);
    this.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });
}

