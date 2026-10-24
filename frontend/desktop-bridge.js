/**
 * Ziphay AI — Desktop Bridge Script
 * Connects the web frontend to native Windows Desktop capabilities
 * via window.ziphayDesktop (Electron context isolation bridge).
 */

(function () {
  if (!window.ziphayDesktop) return; // Only execute when running in Electron desktop shell

  console.log('%c[Ziphay Desktop] Native Windows integration initialized ✓', 'background:#00d4aa;color:#050508;font-weight:bold;padding:2px 8px;border-radius:4px');

  let currentDesktopFiles = []; // Original file paths
  let desktopSettings = {
    outputDirectory: '',
    defaultSuffix: '_ziphay',
    autoRevealInExplorer: true
  };

  // Convert base64 dataUrl to browser File object
  async function dataUrlToFile(dataUrl, filename, mimeType) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
  }

  // Load and apply desktop settings
  async function initSettings() {
    try {
      const s = await window.ziphayDesktop.getSettings();
      if (s) desktopSettings = { ...desktopSettings, ...s };
    } catch (e) {
      console.warn('Could not load desktop settings:', e);
    }
  }

  // Handle incoming file payload (from Explorer context menu or CLI)
  async function handleDesktopPayload(payload) {
    if (!payload || !payload.files || !payload.files.length) return;

    const { files, action } = payload;
    currentDesktopFiles = files;

    // 1. Switch mode if specified
    const validModes = ['compress', 'upscale', 'denoise', 'bgremove'];
    const targetMode = (action && validModes.includes(action)) ? action : 'compress';
    if (typeof switchMode === 'function') {
      switchMode(targetMode);
    }

    // 2. Read each file via native IPC
    const loadedFiles = [];
    for (const filePath of files) {
      try {
        const fileData = await window.ziphayDesktop.readFile(filePath);
        if (fileData.success) {
          const fileObj = await dataUrlToFile(fileData.dataUrl, fileData.name, fileData.type);
          fileObj._originalDiskPath = filePath; // attach disk path
          loadedFiles.push(fileObj);
        } else {
          console.error('Failed to read file:', fileData.error);
        }
      } catch (err) {
        console.error('Error loading native file:', err);
      }
    }

    // 3. Add to processing queue
    if (loadedFiles.length && typeof addFiles === 'function') {
      // Clear any existing selected files first
      if (typeof resetIdle === 'function') resetIdle();
      addFiles(loadedFiles);

      // Show toast notifying user
      if (typeof showToast === 'function') {
        showToast(`⚡ Opened ${loadedFiles.length} file(s) from Windows Explorer!`, 'success', 3000);
      }

      // Auto-scroll to processing card
      const uploadCard = document.querySelector('.upload-card');
      if (uploadCard) uploadCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Inject Desktop UI Controls
  function injectDesktopUI() {
    // 1. Navigation Pill
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && !document.getElementById('navDesktopPill')) {
      const pill = document.createElement('div');
      pill.id = 'navDesktopPill';
      pill.className = 'nav-desktop-badge';
      pill.innerHTML = `
        <span class="desktop-indicator-dot"></span>
        <span>Windows App</span>
        <button id="desktopSettingsBtn" title="File Explorer Context Menu Settings" style="background:none;border:none;cursor:pointer;color:inherit;font-size:12px;padding:0 2px;">⚙️</button>
      `;
      navLinks.insertBefore(pill, navLinks.firstChild);

      document.getElementById('desktopSettingsBtn')?.addEventListener('click', openDesktopSettingsModal);
    }

    // 2. Add "Reveal in Explorer" button to Result Box
    const resultBox = document.getElementById('resultBox');
    if (resultBox && !document.getElementById('revealExplorerBtn')) {
      const actionsWrap = document.querySelector('.result-actions') || resultBox;
      const revealBtn = document.createElement('button');
      revealBtn.id = 'revealExplorerBtn';
      revealBtn.className = 'btn-secondary';
      revealBtn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;font-family:\'Syne\',sans-serif;font-weight:700;font-size:0.88rem;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--text);border:1px solid rgba(255,255,255,0.12);transition:all 0.25s ease;';
      revealBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        Reveal in Explorer
      `;
      revealBtn.addEventListener('click', async () => {
        if (lastSavedFilePath) {
          await window.ziphayDesktop.showInFolder(lastSavedFilePath);
        } else if (currentDesktopFiles.length) {
          await window.ziphayDesktop.showInFolder(currentDesktopFiles[0]);
        } else {
          if (typeof showToast === 'function') showToast('No output file path recorded yet.', 'info');
        }
      });
      actionsWrap.appendChild(revealBtn);
    }
  }

  let lastSavedFilePath = null;

  // Intercept triggerDownload to also save directly to native disk
  const originalTriggerDownload = window.triggerDownload;
  window.triggerDownload = async function (blob, filename) {
    if (originalTriggerDownload) {
      originalTriggerDownload(blob, filename);
    }

    // Save to local disk via native IPC
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const origPath = currentDesktopFiles.length ? currentDesktopFiles[0] : null;
        const ext = filename.split('.').pop();
        
        const res = await window.ziphayDesktop.saveProcessedFile({
          originalPath: origPath,
          bufferData: base64Data,
          suffix: desktopSettings.defaultSuffix || '_ziphay',
          extension: ext,
          customOutputDir: desktopSettings.outputDirectory || undefined
        });

        if (res.success) {
          lastSavedFilePath = res.outputPath;
          if (typeof showToast === 'function') {
            showToast(`💾 Saved locally: ${res.fileName}`, 'success', 4000);
          }
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.warn('Native local save error:', e);
    }
  };

  // Desktop Settings Modal
  async function openDesktopSettingsModal() {
    let modal = document.getElementById('desktopSettingsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'desktopSettingsModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,8,0.75);backdrop-filter:blur(16px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
      modal.innerHTML = `
        <div style="background:#0c0c11;border:1px solid rgba(0,212,170,0.3);border-radius:20px;padding:28px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6);color:#fff;font-family:'Inter',sans-serif;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">🪟</span>
              <h3 style="margin:0;font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:700;">Windows Desktop Settings</h3>
            </div>
            <button id="closeDesktopModal" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;">✕</button>
          </div>
          
          <div style="margin-bottom:20px;padding:14px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-weight:600;font-size:0.95rem;">File Explorer Right-Click Menu</span>
              <span id="menuStatusBadge" style="font-size:0.75rem;padding:3px 8px;border-radius:6px;background:rgba(0,212,170,0.15);color:var(--teal);font-weight:600;">Checking...</span>
            </div>
            <p style="margin:0 0 12px 0;font-size:0.8rem;color:#888;line-height:1.4;">
              Enables right-click actions ("Compress Image", "Upscale with AI", "Remove BG") directly inside Windows File Explorer.
            </p>
            <div style="display:flex;gap:10px;">
              <button id="regMenuBtn" style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:var(--teal);color:#050508;font-weight:700;font-size:0.82rem;cursor:pointer;">Enable Integration</button>
              <button id="unregMenuBtn" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:none;color:#aaa;font-size:0.82rem;cursor:pointer;">Disable</button>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Default Filename Suffix</label>
            <input id="settingSuffix" type="text" value="${desktopSettings.defaultSuffix || '_ziphay'}" style="width:100%;box-sizing:border-box;padding:10px 12px;background:#14141d;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:0.9rem;">
            <span style="display:block;font-size:0.75rem;color:#777;margin-top:4px;">Example: photo.jpg → photo_ziphay.webp</span>
          </div>

          <div style="text-align:right;">
            <button id="saveDesktopSettingsBtn" style="padding:10px 20px;border-radius:10px;border:none;background:var(--teal);color:#050508;font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;">Save Preferences</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('closeDesktopModal')?.addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      // Check context menu status
      const updateMenuBadge = async () => {
        const isReg = await window.ziphayDesktop.isContextMenuRegistered();
        const badge = document.getElementById('menuStatusBadge');
        if (badge) {
          badge.textContent = isReg ? 'Active ✓' : 'Disabled';
          badge.style.background = isReg ? 'rgba(0,212,170,0.15)' : 'rgba(239,68,68,0.15)';
          badge.style.color = isReg ? 'var(--teal)' : '#f87171';
        }
      };
      updateMenuBadge();

      document.getElementById('regMenuBtn')?.addEventListener('click', async () => {
        const res = await window.ziphayDesktop.registerContextMenu();
        if (typeof showToast === 'function') showToast(res.message, res.success ? 'success' : 'error');
        updateMenuBadge();
      });

      document.getElementById('unregMenuBtn')?.addEventListener('click', async () => {
        const res = await window.ziphayDesktop.unregisterContextMenu();
        if (typeof showToast === 'function') showToast(res.message, res.success ? 'success' : 'error');
        updateMenuBadge();
      });

      document.getElementById('saveDesktopSettingsBtn')?.addEventListener('click', async () => {
        const suffixInput = document.getElementById('settingSuffix');
        if (suffixInput) desktopSettings.defaultSuffix = suffixInput.value;
        await window.ziphayDesktop.saveSettings(desktopSettings);
        if (typeof showToast === 'function') showToast('Settings saved!', 'success');
        modal.remove();
      });
    }
  }

  // Add styles for desktop UI badges
  const style = document.createElement('style');
  style.textContent = `
    .nav-desktop-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0, 212, 170, 0.12);
      border: 1px solid rgba(0, 212, 170, 0.3);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--teal);
      letter-spacing: 0.02em;
    }
    .desktop-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--teal);
      box-shadow: 0 0 8px var(--teal);
      animation: pulseDesktop 2s infinite ease-in-out;
    }
    @keyframes pulseDesktop {
      0%, 100% { opacity: 0.6; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    await initSettings();
    injectDesktopUI();

    // Check for initial payload
    const initialPayload = await window.ziphayDesktop.getInitialPayload();
    if (initialPayload && initialPayload.files && initialPayload.files.length) {
      setTimeout(() => handleDesktopPayload(initialPayload), 400);
    }

    // Listen for files passed on second-instance
    window.ziphayDesktop.onFilesReceived((payload) => {
      handleDesktopPayload(payload);
    });
  });
})();
