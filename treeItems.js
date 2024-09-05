const vscode = require('vscode');

class SidenoteItem extends vscode.TreeItem {
  constructor(label, filePath) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.filePath = filePath;
    this.tooltip = `${label}`;
    this.description = '';
    this.contextValue = 'sidenoteItem';
    this.command = {
      command: 'sidenotes.openFile',
      title: 'Open File',
      arguments: [this.filePath],
    };
  }
}

class SidenoteFolder extends vscode.TreeItem {
  constructor(label, folderPath) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.folderPath = folderPath;
    this.tooltip = `${label}`;
    this.description = '';
    this.contextValue = 'sidenoteFolder';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.command = {
      command: 'sidenotes.selectItem',
      title: 'Select Item',
      arguments: [this],
    };
  }
}

module.exports = { SidenoteItem, SidenoteFolder };