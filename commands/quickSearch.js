const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;

async function quickSearch(sidenoteProvider, treeView) {
  const quickPick = vscode.window.createQuickPick();
  quickPick.placeholder = "Search for notes...";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  let searchTimeout;

  quickPick.onDidChangeValue(async (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const searchResults = await searchNotes(value, sidenoteProvider.sidenotesFolderPath);
      quickPick.items = searchResults.map((result) => ({
        label: path.basename(result.filePath, ".md"),
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
      const doc = await vscode.workspace.openTextDocument(
        selectedItem.filePath
      );
      await vscode.window.showTextDocument(doc);

      // Locate and select the file in the sidebar
      await sidenoteProvider.selectFileInSidebar(selectedItem.filePath, treeView);
    }
  });

  quickPick.show();
}

async function searchNotes(searchTerm, sidenotesFolderPath) {
  const results = [];
  const files = await getAllMarkdownFiles(sidenotesFolderPath);

  for (const file of files) {
    const fileName = path.basename(file, ".md").toLowerCase();
    if (fileName.includes(searchTerm.toLowerCase())) {
      results.push({ filePath: file });
    } else {
      const content = await fs.readFile(file, "utf-8");
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
    } else if (path.extname(file.name).toLowerCase() === ".md") {
      mdFiles.push(fullPath);
    }
  }

  return mdFiles;
}

module.exports = {
  quickSearch
};