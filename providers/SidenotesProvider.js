const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;

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

  async getChildren(element) {
    if (element) {
      return this.getSidenotesItems(element.folderPath);
    } else {
      return this.getSidenotesItems(this.sidenotesFolderPath);
    }
  }

  async getSidenotesItems(folderPath) {
    const items = [];
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    // Add folders first
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(folderPath, entry.name);
        items.push(
          new SidenoteFolder(
            entry.name,
            fullPath,
            vscode.TreeItemCollapsibleState.Collapsed
          )
        );
      }
    }

    // Then add markdown files
    for (const entry of entries) {
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
        const fullPath = path.join(folderPath, entry.name);
        const displayName = path.basename(entry.name, ".md");
        items.push(
          new SidenoteItem(
            displayName,
            fullPath,
            vscode.TreeItemCollapsibleState.None
          )
        );
      }
    }

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

  async selectFileInSidebar(filePath, treeView) {
    const relativePath = path.relative(this.sidenotesFolderPath, filePath);
    const pathParts = relativePath.split(path.sep);
    let currentPath = this.sidenotesFolderPath;
    
    for (let i = 0; i < pathParts.length; i++) {
      currentPath = path.join(currentPath, pathParts[i]);
      const isLastPart = i === pathParts.length - 1;
      
      if (isLastPart) {
        const item = new SidenoteItem(
          path.basename(currentPath, ".md"),
          currentPath,
          vscode.TreeItemCollapsibleState.None
        );
        await treeView.reveal(item, { select: true, focus: true, expand: true });
      } else {
        const folder = new SidenoteFolder(
          pathParts[i],
          currentPath,
          vscode.TreeItemCollapsibleState.Expanded
        );
        await treeView.reveal(folder, { select: false, focus: false, expand: true });
      }
    }
  }
}

module.exports = {
  SidenotesProvider,
  SidenoteItem,
  SidenoteFolder
};