const { app } = require('electron');

// Compatibility fix for v3.1.0: Electron app.getPath() does not support
// the custom name "applicationSupport" used by the legacy main process.
// appData is the canonical macOS ~/Library/Application Support base path.
const nativeGetPath = app.getPath.bind(app);
app.getPath = function patchedGetPath(name) {
  if (name === 'applicationSupport') return nativeGetPath('appData');
  return nativeGetPath(name);
};

require('./main.js');
