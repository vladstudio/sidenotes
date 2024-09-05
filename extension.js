const vscode = require('vscode');
const { SidenotesProvider } = require('./sidenotesProvider');
const { initializeCommands } = require('./commands');
const { initializeConfig, handleConfigurationChange } = require('./config');
const { showNotification } = require('./showNotification');

let sidenoteProvider;
let configurationChangeListener;

async function activate(context) {
  console.log('Sidenotes extension is now active!');

  try {
    await initializeExtension(context);
  } catch (error) {
    console.error('Failed to initialize Sidenotes extension:', error);
    showNotification('Failed to initialize Sidenotes extension. Please check the logs.', 'error');
  }
}

async function initializeExtension(context) {
  const config = await initializeConfig();
  const showHiddenFiles = vscode.workspace.getConfiguration('sidenotes').get('showHiddenFiles');
  sidenoteProvider = new SidenotesProvider(config.sidenotesFolderPath, showHiddenFiles);

  const treeView = vscode.window.createTreeView('sidenotes-files', {
    treeDataProvider: sidenoteProvider,
    showCollapseAll: true,
  });

  initializeCommands(context, sidenoteProvider, treeView);

  configurationChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('sidenotes.showHiddenFiles')) {
      const newShowHiddenFiles = vscode.workspace.getConfiguration('sidenotes').get('showHiddenFiles');
      sidenoteProvider.updateShowHiddenFiles(newShowHiddenFiles);
      sidenoteProvider.refresh();
    }
    handleConfigurationChange(e);
  });
  context.subscriptions.push(configurationChangeListener);

  // Watch for changes in the sidenotes folder
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(config.sidenotesFolderPath, '**/*')
  );

  watcher.onDidChange(() => sidenoteProvider.refresh());
  watcher.onDidCreate(() => sidenoteProvider.refresh());
  watcher.onDidDelete(() => sidenoteProvider.refresh());

  context.subscriptions.push(watcher);
}

function deactivate() {
  if (configurationChangeListener) {
    configurationChangeListener.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};
