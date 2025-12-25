import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ... imports stay the same

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('hspice-pwl.start', () => {
            const editor = vscode.window.activeTextEditor;
            const columnToShowIn = editor ? editor.viewColumn : undefined;

            if (currentPanel) {
                currentPanel.reveal(columnToShowIn);
            } else {
                currentPanel = vscode.window.createWebviewPanel(
                    'hspicePWL',
                    'HSPICE PWL Designer',
                    columnToShowIn || vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
                        retainContextWhenHidden: true
                    }
                );

                currentPanel.webview.html = getWebviewContent(currentPanel.webview, context);

                currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);
                
                currentPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'copy':
                                vscode.env.clipboard.writeText(message.text);
                                vscode.window.showInformationMessage('PWL copied to clipboard!');
                                return;
                            case 'insert':
                                if (editor) {
                                    editor.edit(editBuilder => {
                                        // If user had text selected, replace it. Otherwise insert.
                                        if (!editor.selection.isEmpty) {
                                            editBuilder.replace(editor.selection, message.text);
                                        } else {
                                            editBuilder.insert(editor.selection.active, message.text);
                                        }
                                    });
                                }
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );
            }

            // --- NEW: Import Selected Text ---
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                const parsedPoints = parseHSpicePWL(selectedText);
                
                if (parsedPoints.length > 0) {
                    // Send data to webview after a brief delay to ensure it's loaded
                    setTimeout(() => {
                        currentPanel?.webview.postMessage({ command: 'import', points: parsedPoints });
                    }, 500);
                } else {
                    vscode.window.showWarningMessage("Could not parse PWL points from selection.");
                }
            }
        })
    );
}

function parseHSpicePWL(text: string) {
    // Matches PWL followed by parentheses content
    const pwlMatch = text.match(/PWL\s*\(([\s\S]*?)\)/i);
    const rawContent = pwlMatch ? pwlMatch[1] : text;

    // Pattern: 
    //   ([-+]?[0-9]*\.?[0-9]+)  -> Captures the number (e.g., 23.763 or .5 or 10)
    //   ([a-zA-Z]*)             -> Captures the suffix (e.g., n, u, meg)
    // We ignore commas and spaces automatically by strictly searching for this pattern.
    const numberPattern = /([-+]?[0-9]*\.?[0-9]+)([a-zA-Z]*)/g;
    
    const tokens: {val: number, suffix: string}[] = [];
    let match;
    
    while ((match = numberPattern.exec(rawContent)) !== null) {
        tokens.push({
            val: parseFloat(match[1]),
            suffix: match[2].toLowerCase()
        });
    }

    const points: {t: number, v: number}[] = [];
    
    // Multipliers map
    const unitMultipliers: {[key: string]: number} = {
        'f': 1e-15, 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3, 
        'k': 1e3, 'meg': 1e6, 'g': 1e9, 't': 1e12,
        's': 1, 'v': 1 // Handle if user typed '10s' or '5v'
    };

    for (let i = 0; i < tokens.length - 1; i += 2) {
        const tToken = tokens[i];
        const vToken = tokens[i+1];

        let tVal = tToken.val;
        if (unitMultipliers[tToken.suffix]) tVal *= unitMultipliers[tToken.suffix];
        
        let vVal = vToken.val;
        if (unitMultipliers[vToken.suffix]) vVal *= unitMultipliers[vToken.suffix];

        points.push({ t: tVal, v: vVal });
    }

    return points;
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const htmlPath = path.join(context.extensionPath, 'media', 'webview.html');
    const cssPathOnDisk = vscode.Uri.file(path.join(context.extensionPath, 'media', 'style.css'));
    
    const jsPathOnDisk = vscode.Uri.file(path.join(context.extensionPath, 'media', 'main.js'));

    const styleUri = webview.asWebviewUri(cssPathOnDisk);
    const scriptUri = webview.asWebviewUri(jsPathOnDisk);
    
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    htmlContent = htmlContent.replace(/\${webview.cspSource}/g, webview.cspSource);
    htmlContent = htmlContent.replace('{{styleUri}}', styleUri.toString());
    htmlContent = htmlContent.replace('{{scriptUri}}', scriptUri.toString());

    return htmlContent;
}

export function deactivate() {}