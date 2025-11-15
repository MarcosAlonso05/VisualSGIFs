// src/extension.ts
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

    // 2. Start monitoring for events
    eventMonitor.startMonitoring();

    // 3. Register the "Hello World" command as our Test command
    let disposable = vscode.commands.registerCommand('visualsgifs.helloWorld', () => {
        
        // Show a quick notification
        vscode.window.showInformationMessage('Test: Triggering a GIF...');
        
        // Manually trigger the 'test' mood
        eventMonitor.triggerGif('test');
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    console.log('[visualSgifs] Extension deactivated.');
}