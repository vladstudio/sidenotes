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

    // Register command to create new note
    vscode.commands.registerCommand('sidenotes.createNewNote', async () => {
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter the name for the new note',
            placeHolder: 'New Note'
        });

        if (fileName) {
            const activeEditor = vscode.window.activeTextEditor;
            let targetFolder = sidenotesFolderPath;

            if (activeEditor && activeEditor.document.uri.fsPath.startsWith(sidenotesFolderPath)) {
                targetFolder = path.dirname(activeEditor.document.uri.fsPath);
            }

            const newFilePath = path.join(targetFolder, `${fileName}.md`);
            
            fs.writeFile(newFilePath, '', (err) => {
                if (err) {
                    vscode.window.showErrorMessage(`Failed to create note: ${err.message}`);
                } else {
                    vscode.workspace.openTextDocument(newFilePath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                    sidenoteProvider.refresh();
                }
            });
        }
    });

    // Watch for changes in the .sidenotes folder
    const watcher = fs.watch(sidenotesFolderPath, { recursive: true, persistent: false }, (eventType, filename) => {
        if (filename) {
            console.log(`File ${filename} has been ${eventType}`);
            sidenoteProvider.refresh();
        }
    });

    // Dispose the watcher when the extension is deactivated
    context.subscriptions.push({
        dispose: () => watcher.close()
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
            .filter(entry => entry.isDirectory())
            .forEach(folder => {
                const fullPath = path.join(folderPath, folder.name);
                items.push(new SidenoteFolder(folder.name, fullPath, vscode.TreeItemCollapsibleState.Collapsed));
            });

        // Then add markdown files
        entries
            .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md')
            .forEach(file => {
                const fullPath = path.join(folderPath, file.name);
                const displayName = path.basename(file.name, '.md');
                items.push(new SidenoteItem(displayName, fullPath, vscode.TreeItemCollapsibleState.None));
            });

        return items;
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

class SidenoteFolder extends vscode.TreeItem {
    constructor(label, folderPath, collapsibleState) {
        super(label, collapsibleState);
        this.folderPath = folderPath;
        this.tooltip = `${label}`;
        this.description = '';
        this.contextValue = 'folder';
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
