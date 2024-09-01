const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);

let sidenotesFolderPath;

function activate(context) {
  console.log("Sidenotes extension is now active!");

  // Create .sidenotes folder in user's home directory
  // const homeDir = process.env.HOME || process.env.USERPROFILE;
  // sidenotesFolderPath = path.join(homeDir, ".sidenotes");
  // Get the configuration
  const config = vscode.workspace.getConfiguration("sidenotes");
  const customRootFolder = config.get("rootFolder");

  // Set sidenotesFolderPath based on the configuration
  if (customRootFolder) {
    sidenotesFolderPath = path.resolve(customRootFolder);
  } else {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    sidenotesFolderPath = path.join(homeDir, ".sidenotes");
  }

  if (!fs.existsSync(sidenotesFolderPath)) {
    fs.mkdirSync(sidenotesFolderPath, { recursive: true });
  }

  // Register SidenotesProvider
  const sidenoteProvider = new SidenotesProvider(sidenotesFolderPath);
  vscode.window.createTreeView("sidenotes-files", {
    treeDataProvider: sidenoteProvider,
    showCollapseAll: true,
  });

  // Register refresh command
  vscode.commands.registerCommand("sidenotes.refreshSidebar", () =>
    sidenoteProvider.refresh()
  );

  // Register command to open file
  vscode.commands.registerCommand("sidenotes.openFile", (filePath) => {
    vscode.workspace.openTextDocument(filePath).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
  });

  // Register command to create new note
  vscode.commands.registerCommand("sidenotes.createNewNote", async () => {
    await createNewItem("note", sidenoteProvider);
  });

  // Register command to create new folder
  vscode.commands.registerCommand("sidenotes.createNewFolder", async () => {
    await createNewItem("folder", sidenoteProvider);
  });

  // Register command to select an item
  vscode.commands.registerCommand("sidenotes.selectItem", (item) => {
    sidenoteProvider.setSelectedItem(item);
  });

  // Register command to delete an item
  vscode.commands.registerCommand("sidenotes.deleteItem", async (item) => {
    await deleteItem(item, sidenoteProvider);
  });

  // Register command to rename an item
  vscode.commands.registerCommand("sidenotes.renameItem", async (item) => {
    await renameItem(item, sidenoteProvider);
  });

  // Register command for quick search
  vscode.commands.registerCommand("sidenotes.quickSearch", async () => {
    await quickSearch(sidenoteProvider);
  });

  // Watch for changes in the sidenotes folder
  const watcher = fs.watch(
    sidenotesFolderPath,
    { recursive: true, persistent: false },
    (eventType, filename) => {
      if (filename) {
        console.log(`File ${filename} has been ${eventType}`);
        sidenoteProvider.refresh();
      }
    }
  );

  // Dispose the watcher when the extension is deactivated
  context.subscriptions.push({
    dispose: () => watcher.close(),
  });
}

// Helper function to show notifications with auto-closing
function showNotification(message, type = "info") {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: message,
      cancellable: false,
    },
    async (progress) => {
      for (let i = 0; i < 40; i++) {
        progress.report({ increment: 2.5 });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  );
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
        await fs.promises.writeFile(newPath, "");
        const doc = await vscode.workspace.openTextDocument(newPath);
        await vscode.window.showTextDocument(doc);
      } else {
        await fs.promises.mkdir(newPath);
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
      await fs.promises.rename(oldPath, newPath);
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

async function quickSearch(sidenoteProvider) {
  const quickPick = vscode.window.createQuickPick();
  quickPick.placeholder = "Search for notes...";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  let searchTimeout;

  quickPick.onDidChangeValue(async (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const searchResults = await searchNotes(value);
      quickPick.items = searchResults.map((result) => ({
        label: path.basename(result.filePath, ".md"),
        description: result.description,
        detail: path.relative(sidenotesFolderPath, result.filePath),
        filePath: result.filePath,
      }));
    }, 200);
  });

  quickPick.onDidAccept(async () => {
    const selectedItem = quickPick.selectedItems[0];
    if (selectedItem) {
      quickPick.hide();
      const doc = await vscode.workspace.openTextDocument(
        selectedItem.filePath
      );
      await vscode.window.showTextDocument(doc);
    }
  });

  quickPick.show();
}

async function searchNotes(searchTerm) {
  const results = [];
  const files = await getAllMarkdownFiles(sidenotesFolderPath);

  for (const file of files) {
    const fileName = path.basename(file, ".md").toLowerCase();
    if (fileName.includes(searchTerm.toLowerCase())) {
      results.push({ filePath: file });
    } else {
      const content = await readFileAsync(file, "utf-8");
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
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const mdFiles = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      mdFiles.push(...(await getAllMarkdownFiles(fullPath)));
    } else if (path.extname(file.name).toLowerCase() === ".md") {
      mdFiles.push(fullPath);
    }
  }

  return mdFiles;
}

async function moveToTrash(itemPath) {
  if (process.platform === "darwin") {
    // macOS
    await execAsync(
      `osascript -e 'tell app "Finder" to delete POSIX file "${itemPath}"'`
    );
  } else if (process.platform === "win32") {
    // Windows
    await execAsync(
      `powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${itemPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`
    );
  } else {
    // Linux and other platforms
    await execAsync(`gio trash "${itemPath}"`);
  }
}

function getTargetFolder(sidenoteProvider) {
  const selectedItem = sidenoteProvider.getSelectedItem();
  let targetFolder = sidenotesFolderPath;
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

class SidenotesProvider {
  constructor(sidenotesFolderPath) {
    this.sidenotesFolderPath = sidenotesFolderPath;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._selectedItem = null;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (element) {
      return this.getSidenotesItems(element.folderPath);
    } else {
      return this.getSidenotesItems(this.sidenotesFolderPath);
    }
  }

  getSidenotesItems(folderPath) {
    const items = [];
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    // Add folders first
    entries
      .filter((entry) => entry.isDirectory())
      .forEach((folder) => {
        const fullPath = path.join(folderPath, folder.name);
        items.push(
          new SidenoteFolder(
            folder.name,
            fullPath,
            vscode.TreeItemCollapsibleState.Collapsed
          )
        );
      });

    // Then add markdown files
    entries
      .filter(
        (entry) =>
          entry.isFile() && path.extname(entry.name).toLowerCase() === ".md"
      )
      .forEach((file) => {
        const fullPath = path.join(folderPath, file.name);
        const displayName = path.basename(file.name, ".md");
        items.push(
          new SidenoteItem(
            displayName,
            fullPath,
            vscode.TreeItemCollapsibleState.None
          )
        );
      });

    return items;
  }

  getSelectedItem() {
    return this._selectedItem;
  }

  setSelectedItem(item) {
    this._selectedItem = item;
  }

  getParent(element) {
    if (element.filePath) {
      const parentPath = path.dirname(element.filePath);
      if (parentPath === this.sidenotesFolderPath) {
        return null;
      }
      return new SidenoteFolder(
        path.basename(parentPath),
        parentPath,
        vscode.TreeItemCollapsibleState.Expanded
      );
    }
    return null;
  }
}

class SidenoteItem extends vscode.TreeItem {
  constructor(label, filePath, collapsibleState) {
    super(label, collapsibleState);
    this.filePath = filePath;
    this.tooltip = `${label}`;
    this.description = "";
    this.contextValue = "sidenoteItem";
    this.command = {
      command: "sidenotes.openFile",
      title: "Open File",
      arguments: [this.filePath],
    };
  }
}

class SidenoteFolder extends vscode.TreeItem {
  constructor(label, folderPath, collapsibleState) {
    super(label, collapsibleState);
    this.folderPath = folderPath;
    this.tooltip = `${label}`;
    this.description = "";
    this.contextValue = "sidenoteFolder";
    this.iconPath = new vscode.ThemeIcon("folder");
    this.command = {
      command: "sidenotes.selectItem",
      title: "Select Item",
      arguments: [this],
    };
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
