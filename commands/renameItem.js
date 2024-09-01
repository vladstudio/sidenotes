const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { showNotification } = require('../utils/fileUtils');
const { SidenoteFolder, SidenoteItem } = require('../providers/SidenotesProvider');

async function renameItem(item, sidenoteProvider) {
  const oldPath =
    item instanceof SidenoteFolder ? item.folderPath : item.filePath;
  const oldName = item.label;
  const isFolder = item instanceof SidenoteFolder;

  const newName = await vscode.window.showInputBox({
    prompt: `Enter new name for "${oldName}"`,
    value: oldName,
    validateInput: (value) => {
      if (value.trim().length === 0) {
        return "Name cannot be empty";
      }
      if (isFolder && value.includes(".")) {
        return "Folder name cannot contain a dot";
      }
      return null;
    },
  });

  if (newName && newName !== oldName) {
    const newPath = isFolder
      ? path.join(path.dirname(oldPath), newName)
      : path.join(path.dirname(oldPath), `${newName}.md`);

    try {
      await fs.rename(oldPath, newPath);
      showNotification(`"${oldName}" has been renamed to "${newName}".`);

      // Create a new item with the updated name and path
      const newItem = isFolder
        ? new SidenoteFolder(
            newName,
            newPath,
            vscode.TreeItemCollapsibleState.Collapsed
          )
        : new SidenoteItem(
            newName,
            newPath,
            vscode.TreeItemCollapsibleState.None
          );

      // Update the selected item in the provider
      sidenoteProvider.setSelectedItem(newItem);

      // Refresh the sidebar
      sidenoteProvider.refresh();

      // If it's a file, reload it in the editor
      if (!isFolder) {
        const oldEditor = vscode.window.visibleTextEditors.find(
          (editor) => editor.document.uri.fsPath === oldPath
        );
        if (oldEditor) {
          const document = await vscode.workspace.openTextDocument(newPath);
          await vscode.window.showTextDocument(document, oldEditor.viewColumn);
        }
      }
    } catch (err) {
      showNotification(
        `Failed to rename "${oldName}": ${err.message}`,
        "error"
      );
    }
  }
}

module.exports = {
  renameItem
};