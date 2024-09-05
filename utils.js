const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const { exec } = require('child_process');
const { showNotification } = require('./showNotification');
const { SidenoteFolder, SidenoteItem } = require('./treeItems');

const execAsync = promisify(exec);

async function createNewItem(itemType, sidenoteProvider, treeView) {
  const { targetFolder, parentFolderName } = getTargetFolder(sidenoteProvider);
  const itemTypeName = itemType === 'note' ? 'note' : 'folder';
  const promptMessage = getPromptMessage(itemTypeName, parentFolderName);

  const itemName = await vscode.window.showInputBox({
    prompt: promptMessage,
    placeHolder: `New ${itemTypeName}`,
  });

  if (itemName) {
    const newPath = itemType === 'note'
      ? path.join(targetFolder, `${itemName}.md`)
      : path.join(targetFolder, itemName);

    try {
      if (itemType === 'note') {
        await fs.writeFile(newPath, '');
        const doc = await vscode.workspace.openTextDocument(newPath);
        await vscode.window.showTextDocument(doc);
        if (treeView) {
          await selectFileInSidebar(newPath, treeView, sidenoteProvider);
        }
      } else {
        await fs.mkdir(newPath);
      }
      sidenoteProvider.refresh();
      showNotification(`${capitalize(itemTypeName)} "${itemName}" created successfully.`);
    } catch (err) {
      showNotification(`Failed to create ${itemTypeName}: ${err.message}`, 'error');
    }
  }
}

async function deleteItem(item, sidenoteProvider) {
  const itemPath = item instanceof SidenoteFolder ? item.folderPath : item.filePath;
  const itemName = item.label;

  const confirmDelete = await vscode.window.showWarningMessage(
    `Move "${itemName}" to the trash?`,
    { modal: true },
    'Yes',
    'No'
  );

  if (confirmDelete === 'Yes') {
    try {
      await moveToTrash(itemPath);
      showNotification(`"${capitalize(itemName)}" has been moved to the trash.`);
      sidenoteProvider.refresh();
    } catch (err) {
      showNotification(`Failed to delete "${itemName}": ${err.message}`, 'error');
    }
  }
}

async function renameItem(item, sidenoteProvider) {
  const oldPath = item instanceof SidenoteFolder ? item.folderPath : item.filePath;
  const oldName = item.label;
  const isFolder = item instanceof SidenoteFolder;

  const newName = await vscode.window.showInputBox({
    prompt: `Enter new name for "${oldName}"`,
    value: oldName,
    validateInput: (value) => {
      if (value.trim().length === 0) {
        return 'Name cannot be empty';
      }
      if (isFolder && value.includes('.')) {
        return 'Folder name cannot contain a dot';
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
      showNotification(`"${capitalize(oldName)}" has been renamed to "${newName}".`);

      // Create a new item with the updated name and path
      const newItem = isFolder
        ? new SidenoteFolder(newName, newPath)
        : new SidenoteItem(newName, newPath);

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
      showNotification(`Failed to rename "${oldName}": ${err.message}`, 'error');
    }
  }
}

async function quickSearch(sidenoteProvider, treeView) {
  const quickPick = vscode.window.createQuickPick();
  quickPick.placeholder = 'Search for notes...';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  let searchTimeout;

  quickPick.onDidChangeValue(async (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const searchResults = await searchNotes(value, sidenoteProvider.sidenotesFolderPath);
      quickPick.items = searchResults.map((result) => ({
        label: path.basename(result.filePath, '.md'),
        description: result.description,
        detail: path.relative(sidenoteProvider.sidenotesFolderPath, result.filePath),
        filePath: result.filePath,
      }));
    }, 200);
  });

  quickPick.onDidAccept(async () => {
    const selectedItem = quickPick.selectedItems[0];
    if (selectedItem) {
      quickPick.hide();
      const doc = await vscode.workspace.openTextDocument(selectedItem.filePath);
      await vscode.window.showTextDocument(doc);
      await selectFileInSidebar(selectedItem.filePath, treeView, sidenoteProvider);
    }
  });

  quickPick.show();
}

async function moveToTrash(itemPath) {
  if (process.platform === 'darwin') {
    // macOS
    await execAsync(`osascript -e 'tell app "Finder" to delete POSIX file "${itemPath}"'`);
  } else if (process.platform === 'win32') {
    // Windows
    await execAsync(`powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${itemPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`);
  } else {
    // Linux and other platforms
    await execAsync(`gio trash "${itemPath}"`);
  }
}

async function searchNotes(searchTerm, sidenotesFolderPath) {
  const results = [];
  const files = await getAllMarkdownFiles(sidenotesFolderPath);

  for (const file of files) {
    const fileName = path.basename(file, '.md').toLowerCase();
    if (fileName.includes(searchTerm.toLowerCase())) {
      results.push({ filePath: file });
    } else {
      const content = await fs.readFile(file, 'utf-8');
      if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push({ filePath: file, description: `contains ${searchTerm}` });
      }
    }

    if (results.length >= 12) {
      break;
    }
  }

  return results;
}

async function getAllMarkdownFiles(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const mdFiles = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      mdFiles.push(...(await getAllMarkdownFiles(fullPath)));
    } else if (path.extname(file.name).toLowerCase() === '.md') {
      mdFiles.push(fullPath);
    }
  }

  return mdFiles;
}

function getTargetFolder(sidenoteProvider) {
  const selectedItem = sidenoteProvider.getSelectedItem();
  let targetFolder = sidenoteProvider.sidenotesFolderPath;
  let parentFolderName = '';

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

async function selectFileInSidebar(filePath, treeView, sidenoteProvider) {
  const relativePath = path.relative(sidenoteProvider.sidenotesFolderPath, filePath);
  const pathParts = relativePath.split(path.sep);

  let currentPath = sidenoteProvider.sidenotesFolderPath;
  for (const part of pathParts) {
    currentPath = path.join(currentPath, part);
    const element = await sidenoteProvider.findElementByPath(currentPath);
    if (element) {
      await treeView.reveal(element, { expand: true, select: false });
    }
  }

  const fileElement = await sidenoteProvider.findElementByPath(filePath);
  if (fileElement) {
    await treeView.reveal(fileElement, { expand: false, select: true, focus: true });
  }
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

module.exports = {
  createNewItem,
  deleteItem,
  renameItem,
  quickSearch,
  moveToTrash,
  selectFileInSidebar
};