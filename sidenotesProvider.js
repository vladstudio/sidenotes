const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { SidenoteItem, SidenoteFolder } = require('./treeItems');

class SidenotesProvider {
  constructor(sidenotesFolderPath, showHiddenFiles) {
    this.sidenotesFolderPath = sidenotesFolderPath;
    this.showHiddenFiles = showHiddenFiles;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._onDidChangeSelection = new vscode.EventEmitter();
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._selectedItem = null;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    const folderPath = element ? element.folderPath : this.sidenotesFolderPath;
    return this.getSidenotesItems(folderPath);
  }

  async getSidenotesItems(folderPath) {
    const items = [];
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    // Filter hidden files if necessary
    const filteredEntries = this.showHiddenFiles ? entries : entries.filter(entry => !entry.name.startsWith('.'));

    // Add folders first
    for (const entry of filteredEntries.filter(entry => entry.isDirectory())) {
      const fullPath = path.join(folderPath, entry.name);
      items.push(new SidenoteFolder(entry.name, fullPath));
    }

    // Then add markdown files
    for (const entry of filteredEntries.filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md')) {
      const fullPath = path.join(folderPath, entry.name);
      const displayName = path.basename(entry.name, '.md');
      items.push(new SidenoteItem(displayName, fullPath));
    }

    return items;
  }

  getSelectedItem() {
    return this._selectedItem;
  }

  setSelectedItem(item) {
    if (this._selectedItem !== item) {
      this._selectedItem = item;
      this._onDidChangeSelection.fire(item);
    }
  }

  getParent(element) {
    if (element.filePath) {
      const parentPath = path.dirname(element.filePath);
      if (parentPath === this.sidenotesFolderPath) {
        return null;
      }
      return new SidenoteFolder(path.basename(parentPath), parentPath);
    }
    return null;
  }

  async findElementByPath(elementPath) {
    const relativePath = path.relative(this.sidenotesFolderPath, elementPath);
    const pathParts = relativePath.split(path.sep);

    let currentElement = null;
    let currentPath = this.sidenotesFolderPath;

    for (const part of pathParts) {
      currentPath = path.join(currentPath, part);
      const children = await this.getChildren(currentElement);
      currentElement = children.find(child => 
        (child instanceof SidenoteFolder ? child.folderPath : child.filePath) === currentPath
      );

      if (!currentElement) {
        return null;
      }
    }

    return currentElement;
  }

  updateShowHiddenFiles(showHiddenFiles) {
    this.showHiddenFiles = showHiddenFiles;
  }

  handleTreeSelectionChange(selection) {
    if (selection && selection.length > 0) {
      this.setSelectedItem(selection[0]);
    } else {
      this.setSelectedItem(null);
    }
  }
}

module.exports = { SidenotesProvider };