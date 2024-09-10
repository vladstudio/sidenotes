const vscode = require('vscode');
const { showNotification } = require('./showNotification');
const { createNewItem, deleteItem, renameItem, quickSearch } = require('./utils');

function initializeCommands(context, sidenoteProvider, treeView) {
  const commands = [
    { name: 'sidenotes.refreshSidebar', handler: () => sidenoteProvider.refresh() },
    { name: 'sidenotes.openFile', handler: openFile },
    { name: 'sidenotes.createNewNote', handler: () => createNewItem('note', sidenoteProvider, treeView) },
    { name: 'sidenotes.createNewFolder', handler: () => createNewItem('folder', sidenoteProvider) },
    { name: 'sidenotes.selectItem', handler: (item) => sidenoteProvider.setSelectedItem(item) },
    { name: 'sidenotes.deleteItem', handler: (item) => deleteItem(item, sidenoteProvider) },
    { name: 'sidenotes.renameItem', handler: (item) => renameItem(item, sidenoteProvider) },
    { name: 'sidenotes.quickSearch', handler: () => quickSearch(sidenoteProvider, treeView) },
    { name: 'sidenotes.openSettings', handler: () => openSettingsWithQuery('Sidenotes') },
  ];

  commands.forEach(({ name, handler }) => {
    context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  });
}

async function openFile(filePath) {
  try {
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, {
      preview: false // This option ensures the document opens in non-preview mode
    });
  } catch (error) {
    showNotification(`Failed to open file: ${error.message}`, 'error');
  }
}

function openSettingsWithQuery(query) {
  vscode.commands.executeCommand('workbench.action.openSettings', query);
}

module.exports = { initializeCommands };