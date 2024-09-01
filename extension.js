const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let sidenotesFolderPath;

function activate(context) {
    console.log('Sidenotes extension is now active!');

    // Create .sidenotes folder in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    sidenotesFolderPath = path.join(homeDir, '.sidenotes');
    if (!fs.existsSync(sidenotesFolderPath)) {
        fs.mkdirSync(sidenotesFolderPath);
    }

    // Register SidenotesProvider
    const sidenoteProvider = new SidenotesProvider(sidenotesFolderPath);
    vscode.window.registerTreeDataProvider('sidenotes-files', sidenoteProvider);

    // Register refresh command
    vscode.commands.registerCommand('sidenotes.refreshSidebar', () => sidenoteProvider.refresh());

    // Register command to open file
    vscode.commands.registerCommand('sidenotes.openFile', (filePath) => {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });
}

class SidenotesProvider {
    constructor(sidenotesFolderPath) {
        this.sidenotesFolderPath = sidenotesFolderPath;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            return this.getSidenotesFiles();
        }
        return null;
    }

    getSidenotesFiles() {
        const files = fs.readdirSync(this.sidenotesFolderPath);
        return files
            .filter(file => path.extname(file).toLowerCase() === '.md')
            .map(file => {
                const filePath = path.join(this.sidenotesFolderPath, file);
                const displayName = path.basename(file, '.md');
                return new SidenoteItem(displayName, filePath, vscode.TreeItemCollapsibleState.None);
            });
    }
}

class SidenoteItem extends vscode.TreeItem {
    constructor(label, filePath, collapsibleState) {
        super(label, collapsibleState);
        this.tooltip = `${label}`;
        this.description = '';
        this.command = {
            command: 'sidenotes.openFile',
            title: 'Open File',
            arguments: [filePath]
        };
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
