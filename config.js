const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { showNotification } = require('./showNotification');

async function initializeConfig() {
  const config = vscode.workspace.getConfiguration('sidenotes');
  const customRootFolder = config.get('rootFolder');

  let sidenotesFolderPath;
  if (customRootFolder) {
    sidenotesFolderPath = path.resolve(customRootFolder);
  } else {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    sidenotesFolderPath = path.join(homeDir, '.sidenotes');
  }

  try {
    await fs.mkdir(sidenotesFolderPath, { recursive: true });
  } catch (error) {
    console.error('Failed to create sidenotes folder:', error);
    showNotification('Failed to create sidenotes folder. Please check the logs.', 'error');
  }

  return { sidenotesFolderPath };
}

function handleConfigurationChange(event) {
  if (event.affectsConfiguration('sidenotes.rootFolder')) {
    console.log('Root Folder setting changed. Restarting extension...');
    restartExtension();
  }
}

async function restartExtension() {
  // Deactivate the current extension instance
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
}

module.exports = {
  initializeConfig,
  handleConfigurationChange
};