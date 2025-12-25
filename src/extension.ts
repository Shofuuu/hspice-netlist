import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('hspice-pwl.start', () => {
            const columnToShowIn = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;

            if (currentPanel) {
                currentPanel.reveal(columnToShowIn);
            } else {
                currentPanel = vscode.window.createWebviewPanel(
                    'hspicePWL',
                    'HSPICE PWL Designer',
                    columnToShowIn || vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                // Pass 'context' so we can find the file path
                currentPanel.webview.html = getWebviewContent(context);

                currentPanel.onDidDispose(
                    () => { currentPanel = undefined; },
                    null,
                    context.subscriptions
                );
                
                // Handle messages from the webview
                currentPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'copy':
                                vscode.env.clipboard.writeText(message.text);
                                vscode.window.showInformationMessage('PWL copied to clipboard!');
                                return;
                            case 'insert':
                                const editor = vscode.window.activeTextEditor;
                                if (editor) {
                                    editor.edit(editBuilder => {
                                        editBuilder.insert(editor.selection.active, message.text);
                                    });
                                }
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );
            }
        })
    );
}

// Updated function: Reads from file instead of hardcoded string
function getWebviewContent(context: vscode.ExtensionContext): string {
    // 1. Get the path to the HTML file on disk
    const htmlPath = path.join(context.extensionPath, 'media', 'webview.html');
    
    // 2. Read the file content
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 3. Return the content
    return htmlContent;
}

export function deactivate() {}