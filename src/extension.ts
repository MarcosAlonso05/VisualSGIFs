import * as vscode from 'vscode';
import { ConfigHelper } from './ConfigHelper';
import { LocalGifProvider } from './LocalGifProvider';
import { GifDisplayManager } from './GifDisplayManager';
import { EventMonitor } from './EventMonitor';

export function activate(context: vscode.ExtensionContext) {

    console.log('[visualSgifs] Extension is now active!');

    // 1. Create all the main components
    const configHelper = new ConfigHelper();
    const localGifProvider = new LocalGifProvider(configHelper);
    const gifDisplayManager = new GifDisplayManager(configHelper);
    
    const eventMonitor = new EventMonitor(
        configHelper,
        localGifProvider,
        gifDisplayManager
    );

    // 2. Start monitoring
    eventMonitor.startMonitoring();

    // 3. Register Disposables
    // This ensures that when the extension is deactivated, timers and listeners are cleaned up.
    context.subscriptions.push(eventMonitor);
    context.subscriptions.push(gifDisplayManager);

    // 4. Register the Test command
    let disposable = vscode.commands.registerCommand('visualsgifs.helloWorld', () => {
        vscode.window.showInformationMessage('Test: Triggering a GIF...');
        eventMonitor.triggerGif('test');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('[visualSgifs] Extension deactivated.');
    // context.subscriptions will be disposed of automatically by VS Code
}