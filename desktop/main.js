const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const contextMenu = require('./context-menu');

let mainWindow = null;
let initialFiles = [];
let initialAction = 'compress';

// Parse command line arguments for files and action
function parseArgs(argv) {
  const files = [];
  let action = 'compress';
  let quality = 'balanced';

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--action=')) {
      action = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--quality=')) {
      quality = arg.split('=')[1].toLowerCase();
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      try {
        if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
          files.push(path.resolve(arg));
        }
      } catch (e) {
        // Ignore unreadable args
      }
    }
  }

  return { files, action, quality };
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  const parsed = parseArgs(process.argv);
  initialFiles = parsed.files;
  initialAction = parsed.action;

  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const newPayload = parseArgs(commandLine);
      if (newPayload.files.length > 0) {
        mainWindow.webContents.send('desktop:files-received', newPayload);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // Auto-register Explorer integration on first launch if not already present
    try {
      if (process.platform === 'win32' && !contextMenu.isContextMenuRegistered()) {
        contextMenu.registerContextMenu();
      }
    } catch (e) {
      console.warn('Could not auto-register context menu:', e);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'frontend', 'favicon.png');

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#050508',
    title: 'Ziphay AI — Smart File Compression & Upscaling',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // allow local media previews
    },
    show: false
  });

  mainWindow.setMenuBarVisibility(false);

  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// ═══════════════ SETTINGS PERSISTENCE ═══════════════
function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'ziphay-settings.json');
}

function loadSettings() {
  try {
    const file = getSettingsFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return {
    outputDirectory: '', // default to source file directory
    defaultSuffix: '_ziphay',
    autoRevealInExplorer: true,
    defaultQuality: 'balanced',
    theme: 'dark'
  };
}

function saveSettings(settings) {
  try {
    const file = getSettingsFilePath();
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════ IPC HANDLERS ═══════════════
ipcMain.handle('desktop:get-initial-payload', () => {
  const payload = {
    files: initialFiles,
    action: initialAction
  };
  // Clear initial after consuming once
  initialFiles = [];
  return payload;
});

ipcMain.handle('desktop:read-file', async (_event, filePath) => {
  try {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    const buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    
    // Determine MIME type
    const mimeMap = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      webm: 'video/webm'
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      success: true,
      name: path.basename(resolvedPath),
      fullPath: resolvedPath,
      size: stat.size,
      type: mimeType,
      dataUrl,
      ext
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('desktop:save-file', async (_event, params) => {
  try {
    const { originalPath, bufferData, suffix = '_ziphay', extension = 'webp', customOutputDir } = params;
    
    if (!originalPath && !customOutputDir) {
      throw new Error('No destination directory specified');
    }

    const targetDir = customOutputDir || path.dirname(originalPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const baseName = originalPath ? path.parse(originalPath).name : 'optimized_file';
    let outputFileName = `${baseName}${suffix}.${extension}`;
    let outputPath = path.join(targetDir, outputFileName);

    // Prevent accidental overwrite — match Windows safe renaming standard
    let counter = 1;
    while (fs.existsSync(outputPath)) {
      outputFileName = `${baseName}${suffix} (${counter}).${extension}`;
      outputPath = path.join(targetDir, outputFileName);
      counter++;
    }

    let writeBuffer;
    if (typeof bufferData === 'string') {
      // Either dataUrl or base64 string
      const base64Data = bufferData.replace(/^data:[^;]+;base64,/, '');
      writeBuffer = Buffer.from(base64Data, 'base64');
    } else {
      writeBuffer = Buffer.from(bufferData);
    }

    fs.writeFileSync(outputPath, writeBuffer);

    return {
      success: true,
      outputPath,
      fileName: outputFileName,
      size: writeBuffer.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('desktop:show-in-folder', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(path.resolve(filePath));
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('desktop:register-context-menu', async () => {
  return contextMenu.registerContextMenu();
});

ipcMain.handle('desktop:unregister-context-menu', async () => {
  return contextMenu.unregisterContextMenu();
});

ipcMain.handle('desktop:is-context-menu-registered', async () => {
  return contextMenu.isContextMenuRegistered();
});

ipcMain.handle('desktop:get-settings', async () => {
  return loadSettings();
});

ipcMain.handle('desktop:save-settings', async (_event, settings) => {
  return saveSettings(settings);
});

// Window controls
ipcMain.on('desktop:window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('desktop:window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('desktop:window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
