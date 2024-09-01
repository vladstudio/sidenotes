const vscode = require("vscode");
const fs = require("fs").promises;
const path = require("path");

const { SidenotesProvider } = require('./providers/SidenotesProvider');
const { createNewItem } = require('./commands/createNewItem');
const { deleteItem } = require('./commands/deleteItem');
const { renameItem } = require('./commands/renameItem');
const { quickSearch } = require('./commands/quickSearch');

let sidenotesFolderPath;

function activate(context) {
  console.log("Sidenotes extension is now active!");

  // Create .sidenotes folder in user's home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  sidenotesFolderPath = path.join(homeDir, ".sidenotes");
  fs.mkdir(sidenotesFolderPath, { recursive: true }).catch(console.error);

  // Register SidenotesProvider
  const sidenoteProvider = new SidenotesProvider(sidenotesFolderPath);
  const treeView = vscode.window.createTreeView("sidenotes-files", {
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
    await quickSearch(sidenoteProvider, treeView);
  });

  // Watch for changes in the .sidenotes folder
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

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
