import * as vscode from 'vscode';
import { ConfigHelper } from './ConfigHelper';
import { GifDisplayManager } from './GifDisplayManager';
import { LocalGifProvider } from './LocalGifProvider';

export class EventMonitor implements vscode.Disposable {
    private afkTimer: NodeJS.Timeout | undefined;
    private errorDebounceTimer: NodeJS.Timeout | undefined;
    private lastErrorLine = -1;
    private disposables: vscode.Disposable[] = [];

    private currentMood: 'afk' | 'error' | 'test' | 'success' | null = null;

    constructor(
        private configHelper: ConfigHelper,
        private gifProvider: LocalGifProvider,
        private displayManager: GifDisplayManager
    ) {}

    public startMonitoring() {
        this.resetAfkTimer();

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(() => this.onUserActivity()),
            vscode.window.onDidChangeActiveTextEditor(() => this.onUserActivity()),
            vscode.window.onDidChangeTextEditorSelection(() => this.onUserActivity())
        );

        // Fails
        this.disposables.push(
            vscode.languages.onDidChangeDiagnostics(e => this.onDiagnosticChange(e))
        );

        // Success (Tasks, Debug, Terminal)
        this.disposables.push(
            vscode.tasks.onDidEndTaskProcess(e => {
                if (e.exitCode === 0) this.tryTriggerSuccess();
            })
        );
        this.disposables.push(
            vscode.debug.onDidReceiveDebugSessionCustomEvent(e => {
                if (e.event === 'exited' && e.body?.exitCode === 0) this.tryTriggerSuccess();
            })
        );
        if (vscode.window.onDidEndTerminalShellExecution) {
            this.disposables.push(
                vscode.window.onDidEndTerminalShellExecution(e => {
                    if (e.exitCode === 0) this.tryTriggerSuccess();
                })
            );
        }

        // Configuration
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('visualsgifs')) {
                    this.resetAfkTimer();
                }
            })
        );
    }

    public dispose() {
        if (this.afkTimer) clearTimeout(this.afkTimer);
        if (this.errorDebounceTimer) clearTimeout(this.errorDebounceTimer);
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    private onUserActivity() {
        this.resetAfkTimer();

        if (this.currentMood === 'error') {
            return; 
        }

        this.forceHideGif();
    }

    private forceHideGif() {
        this.displayManager.hideGif();
        this.currentMood = null;
    }

    private tryTriggerSuccess() {
        if (this.configHelper.isSuccessEnabled()) {
            this.triggerGif('success');
        }
    }

    private resetAfkTimer() {
        if (this.afkTimer) clearTimeout(this.afkTimer);
        
        if (!this.configHelper.isAfkEnabled()) return;

        const afkTimeInMs = this.configHelper.getAfkTimeInMs();
        if (afkTimeInMs > 0) {
            this.afkTimer = setTimeout(() => {
                this.triggerGif('afk');
            }, afkTimeInMs);
        }
    }

    private onDiagnosticChange(diagnosticEvent: vscode.DiagnosticChangeEvent) {
        if (!this.configHelper.isErrorEnabled()) return;

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
        const firstError = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);
        const debounceTime = this.configHelper.getErrorDebounceTime();

        if (firstError) {
            if (firstError.range.start.line === this.lastErrorLine) return;

            if (!this.errorDebounceTimer) {
                this.errorDebounceTimer = setTimeout(() => {
                    const curDiagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
                    const curError = curDiagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);
                    
                    if (curError && curError.range.start.line !== this.lastErrorLine) {
                        this.lastErrorLine = curError.range.start.line;
                        console.log('[visualSgifs] Error persisted. Triggering GIF.');
                        this.triggerGif('error');
                    }
                    this.errorDebounceTimer = undefined;
                }, debounceTime);
            }

        } else {
            if (this.errorDebounceTimer) {
                clearTimeout(this.errorDebounceTimer);
                this.errorDebounceTimer = undefined;
            }
            if (this.currentMood === 'error') {
                this.forceHideGif();
            }
            this.lastErrorLine = -1;
        }
    }

    public async triggerGif(mood: 'afk' | 'error' | 'test' | 'success') {
        try {
            this.currentMood = mood;

            if (mood !== 'error' && this.errorDebounceTimer) {
                clearTimeout(this.errorDebounceTimer);
                this.errorDebounceTimer = undefined;
            }

            const gifPath = await this.gifProvider.getRandomGifPath(mood);
            if (!gifPath) {
                if (mood !== 'success') {
                    console.warn(`[visualSgifs] No GIF found for mood: ${mood}`);
                }
                this.currentMood = null;
                return;
            }

            let durationOverride: number | undefined = undefined;
            
            if (mood === 'afk') {
                durationOverride = 0;
            }

            await this.displayManager.showGif(gifPath, durationOverride);

        } catch (error) {
            console.error('[visualSgifs] Error triggering GIF:', error);
            this.currentMood = null;
        }
    }
}