const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { showNotification } = require('../utils/fileUtils');

function getTargetFolder(sidenoteProvider) {
  const selectedItem = sidenoteProvider.getSelectedItem();
  let targetFolder = sidenoteProvider.sidenotesFolderPath;
  let parentFolderName = "";

  if (selectedItem) {
    if (selectedItem instanceof SidenoteFolder) {
      targetFolder = selectedItem.folderPath;
      parentFolderName = selectedItem.label;
    } else if (selectedItem instanceof SidenoteItem) {
      targetFolder = path.dirname(selectedItem.filePath);
      parentFolderName = path.basename(targetFolder);
    }
  }

  return { targetFolder, parentFolderName };
}

function getPromptMessage(itemTypeName, parentFolderName) {
  return parentFolderName
    ? `Enter the name for the new ${itemTypeName} in ${parentFolderName} folder`
    : `Enter the name for the new ${itemTypeName}`;
}

async function createNewItem(itemType, sidenoteProvider) {
  const { targetFolder, parentFolderName } = getTargetFolder(sidenoteProvider);
  const itemTypeName = itemType === "note" ? "note" : "folder";
  const promptMessage = getPromptMessage(itemTypeName, parentFolderName);

  const itemName = await vscode.window.showInputBox({
    prompt: promptMessage,
    placeHolder: `New ${itemTypeName}`,
  });

  if (itemName) {
    const newPath =
      itemType === "note"
        ? path.join(targetFolder, `${itemName}.md`)
        : path.join(targetFolder, itemName);

    try {
      if (itemType === "note") {
        await fs.writeFile(newPath, "");
        const doc = await vscode.workspace.openTextDocument(newPath);
        await vscode.window.showTextDocument(doc);
      } else {
        await fs.mkdir(newPath);
      }
      sidenoteProvider.refresh();
      showNotification(`${itemTypeName} "${itemName}" created successfully.`);
    } catch (err) {
      showNotification(
        `Failed to create ${itemTypeName}: ${err.message}`,
        "error"
      );
    }
  }
}

module.exports = {
  createNewItem
};