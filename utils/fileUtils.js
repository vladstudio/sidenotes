const vscode = require('vscode');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

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

module.exports = {
  showNotification,
  moveToTrash
};