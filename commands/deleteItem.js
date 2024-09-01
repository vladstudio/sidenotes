const vscode = require('vscode');
const { showNotification, moveToTrash } = require('../utils/fileUtils');
const { SidenoteFolder } = require('../providers/SidenotesProvider');

async function deleteItem(item, sidenoteProvider) {
  const itemPath =
    item instanceof SidenoteFolder ? item.folderPath : item.filePath;
  const itemName = item.label;

  const confirmDelete = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${itemName}"?`,
    { modal: true },
    "Yes",
    "No"
  );

  if (confirmDelete === "Yes") {
    try {
      await moveToTrash(itemPath);
      showNotification(`"${itemName}" has been moved to the trash.`);
      sidenoteProvider.refresh();
    } catch (err) {
      showNotification(
        `Failed to delete "${itemName}": ${err.message}`,
        "error"
      );
    }
  }
}

module.exports = {
  deleteItem
};