import * as vscode from 'vscode';
import { ConfigHelper } from './ConfigHelper';
import { GifDisplayManager } from './GifDisplayManager';
import { LocalGifProvider } from './LocalGifProvider';

export class EventMonitor implements vscode.Disposable {
    private afkTimer: NodeJS.Timeout | undefined;
    private lastErrorLine = -1;
    
    // List of disposables to clean up when extension deactivates
    private disposables: vscode.Disposable[] = [];

    constructor(
        private configHelper: ConfigHelper,
        private gifProvider: LocalGifProvider,
        private displayManager: GifDisplayManager
    ) {}

    public startMonitoring() {
        this.resetAfkTimer();

        // AFK
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(() => this.resetAfkTimer()),
            vscode.window.onDidChangeActiveTextEditor(() => this.resetAfkTimer()),
            vscode.window.onDidChangeTextEditorSelection(() => this.resetAfkTimer())
        );

        // Errors
        this.disposables.push(
            vscode.languages.onDidChangeDiagnostics(e => this.onDiagnosticChange(e))
        );

        // Hide the GIF
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(e => {
                if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
                    this.displayManager.hideGif();
                }
            })
        );

        // Good execution
        this.disposables.push(
            vscode.tasks.onDidEndTaskProcess(e => {
                if (e.exitCode === 0) {
                    this.triggerGif('success');
                }
            })
        );
        this.disposables.push(
            vscode.debug.onDidReceiveDebugSessionCustomEvent(e => {
                if (e.event === 'exited' && e.body?.exitCode === 0) {
                    this.triggerGif('success');
                }
            })
        );
        this.disposables.push(
            vscode.debug.onDidTerminateDebugSession(session => {
                this.triggerGif('success'); 
            })
        );
        if (vscode.window.onDidEndTerminalShellExecution) {
            this.disposables.push(
                vscode.window.onDidEndTerminalShellExecution(e => {
                    if (e.exitCode === 0) {
                        this.triggerGif('success');
                    }
                })
            );
        } else {
            console.warn('[visualSgifs] Shell Integration API not available. Update VS Code for Terminal support.');
        }
        this.disposables.push(
            vscode.debug.onDidTerminateDebugSession(session => {
                console.log('[visualSgifs] Debug session terminated.');
                this.triggerGif('success');
            })
        );
        

        // Listen for config changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('visualsgifs')) {
                    console.log('[visualSgifs] Config updated. Resetting AFK timer.');
                    this.resetAfkTimer();
                }
            })
        );
    }

    // Clean up timers and listeners.
    public dispose() {
        if (this.afkTimer) {
            clearTimeout(this.afkTimer);
            this.afkTimer = undefined;
        }
        
        // Dispose all listeners
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    private resetAfkTimer() {
        if (this.afkTimer) {
            clearTimeout(this.afkTimer);
        }

        const afkTimeInMs = this.configHelper.getAfkTimeInMs();

        if (afkTimeInMs > 0) {
            this.afkTimer = setTimeout(() => {
                this.triggerGif('afk');
            }, afkTimeInMs);
        }
    }

    private onDiagnosticChange(diagnosticEvent: vscode.DiagnosticChangeEvent) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
        const firstError = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);

        if (firstError) {
            if (firstError.range.start.line !== this.lastErrorLine) {
                this.lastErrorLine = firstError.range.start.line;
                console.log('[visualSgifs] New error detected.');
                this.triggerGif('error');
            }
        } else {
            this.lastErrorLine = -1;
        }
    }

    public async triggerGif(mood: 'afk' | 'error' | 'test' | 'success') {
        try {
            const gifPath = await this.gifProvider.getRandomGifPath(mood);
            if (!gifPath) {
                if (mood !== 'success') {
                    console.warn(`[visualSgifs] No GIF found for mood: ${mood}`);
                }
                return;
            }
            await this.displayManager.showGif(gifPath);

        } catch (error) {
            console.error('[visualSgifs] Error triggering GIF:', error);
            vscode.window.showErrorMessage(`visualSgifs: An error occurred: ${error}`);
        }
    }
}