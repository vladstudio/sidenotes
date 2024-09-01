const vscode = require('vscode');

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

module.exports = {
  showNotification
};