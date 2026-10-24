/**
 * Ziphay AI — Windows File Explorer Context Menu Integration
 * 
 * Safely registers cascading context menus under HKCU (Current User)
 * so NO Administrator privileges or UAC prompts are required.
 * Targets SystemFileAssociations for images, videos, and PDFs.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function getCommandTarget(action = '') {
  const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1;
  const actionArg = action ? ` --action=${action}` : '';
  const builtExe = path.resolve(__dirname, '..', 'dist-desktop', 'win-unpacked', 'Ziphay AI.exe');

  if (isPackaged || process.env.ZIPHAY_BINARY_PATH) {
    const exePath = process.env.ZIPHAY_BINARY_PATH || process.execPath;
    return `\\"${exePath}\\" \\"%1\\"${actionArg}`;
  } else if (fs.existsSync(builtExe)) {
    return `\\"${builtExe}\\" \\"%1\\"${actionArg}`;
  } else {
    // Development mode: use electron.exe directly
    const electronExe = path.resolve(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
    const mainScript = path.resolve(__dirname, 'main.js');
    return `\\"${electronExe}\\" \\"${mainScript}\\" \\"%1\\"${actionArg}`;
  }
}

function getIconPath() {
  const icoCandidate = path.resolve(__dirname, '..', 'frontend', 'icon.ico');
  const pngCandidate = path.resolve(__dirname, '..', 'frontend', 'icon.png');
  if (fs.existsSync(icoCandidate)) return icoCandidate;
  if (fs.existsSync(pngCandidate)) return pngCandidate;
  return process.execPath;
}

const ASSOCIATIONS = [
  'SystemFileAssociations\\image',
  'SystemFileAssociations\\video',
  'SystemFileAssociations\\.pdf',
  'SystemFileAssociations\\.webp',
  'SystemFileAssociations\\.heic',
  'SystemFileAssociations\\.avif'
];

const SUBCOMMANDS = [
  { id: '01Compress', label: '🗜️ Compress Image / File', action: 'compress' },
  { id: '02Upscale', label: '✨ Upscale with AI (2× / 4×)', action: 'upscale' },
  { id: '03Denoise', label: '🪄 Denoise Image', action: 'denoise' },
  { id: '04BGRemove', label: '✂️ Remove Background', action: 'bgremove' },
  { id: '05Resize', label: '📐 Resize Image', action: 'resize' },
  { id: '06Open', label: '🚀 Open in Ziphay Studio', action: 'open' }
];

function runReg(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function registerContextMenu() {
  if (process.platform !== 'win32') return { success: false, message: 'Only Windows is supported' };

  const icon = getIconPath();

  for (const assoc of ASSOCIATIONS) {
    const rootKey = `HKCU\\Software\\Classes\\${assoc}\\shell\\ZiphayAI`;

    // Create Root Cascading Menu
    runReg(`reg add "${rootKey}" /v "MUIVerb" /t REG_SZ /d "Ziphay AI" /f`);
    runReg(`reg add "${rootKey}" /v "SubCommands" /t REG_SZ /d "" /f`);
    if (icon) {
      runReg(`reg add "${rootKey}" /v "Icon" /t REG_SZ /d "${icon}" /f`);
    }

    // Add subcommands
    for (const sub of SUBCOMMANDS) {
      const subKey = `${rootKey}\\shell\\${sub.id}`;
      runReg(`reg add "${subKey}" /v "MUIVerb" /t REG_SZ /d "${sub.label}" /f`);
      if (icon) {
        runReg(`reg add "${subKey}" /v "Icon" /t REG_SZ /d "${icon}" /f`);
      }

      const cmdKey = `${subKey}\\command`;
      const targetCmd = getCommandTarget(sub.action === 'open' ? '' : sub.action);
      runReg(`reg add "${cmdKey}" /ve /t REG_SZ /d "${targetCmd}" /f`);
    }
  }

  return { success: true, message: 'Windows File Explorer context menu registered successfully!' };
}

function unregisterContextMenu() {
  if (process.platform !== 'win32') return { success: false, message: 'Only Windows is supported' };

  for (const assoc of ASSOCIATIONS) {
    const rootKey = `HKCU\\Software\\Classes\\${assoc}\\shell\\ZiphayAI`;
    runReg(`reg delete "${rootKey}" /f`);
  }

  return { success: true, message: 'Windows File Explorer context menu removed successfully!' };
}

function isContextMenuRegistered() {
  if (process.platform !== 'win32') return false;
  const testKey = `HKCU\\Software\\Classes\\SystemFileAssociations\\image\\shell\\ZiphayAI`;
  try {
    execSync(`reg query "${testKey}" /v "MUIVerb"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu,
  isContextMenuRegistered
};

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--unregister') {
    const res = unregisterContextMenu();
    console.log(res.message);
  } else {
    const res = registerContextMenu();
    console.log(res.message);
  }
}
