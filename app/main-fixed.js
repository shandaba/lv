const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// v3.1.1 compatibility fix: map legacy "applicationSupport" to Electron appData.
const nativeGetPath = app.getPath.bind(app);
app.getPath = function patchedGetPath(name) {
  if (name === 'applicationSupport') return nativeGetPath('appData');
  return nativeGetPath(name);
};

// Inject the full task editor after the packaged page is loaded.
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('did-finish-load', () => {
    try {
      const code = fs.readFileSync(path.join(__dirname, 'task-editor.js'), 'utf8');
      win.webContents.executeJavaScript(code).catch(() => {});
    } catch (_) {}
  });
});

require('./main.js');
