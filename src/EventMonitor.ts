// src/EventMonitor.ts
import * as vscode from 'vscode'; // <-- LÍNEA CORREGIDA
import { ConfigHelper } from './ConfigHelper';
import { GifDisplayManager } from './GifDisplayManager';
import { LocalGifProvider } from './LocalGifProvider';

export class EventMonitor {
    private afkTimer: NodeJS.Timeout | undefined;
    private lastErrorLine = -1; // To avoid spamming on the same error

    constructor(
        private configHelper: ConfigHelper,
        private gifProvider: LocalGifProvider,
        private displayManager: GifDisplayManager
    ) {}

    /**
     * Starts all event listeners.
     */
    public startMonitoring() {
        // 1. AFK Monitoring
        this.resetAfkTimer();
        // Reset timer on typing...
        vscode.workspace.onDidChangeTextDocument(() => this.resetAfkTimer());
        // ...and on switching files
        vscode.window.onDidChangeActiveTextEditor(() => this.resetAfkTimer());
        // ...and on mouse clicks
        vscode.window.onDidChangeTextEditorSelection(() => this.resetAfkTimer());

        // 2. Error Monitoring
        vscode.languages.onDidChangeDiagnostics(e => this.onDiagnosticChange(e));

        // 3. Click-to-Close Monitoring
        // Si el usuario hace clic en cualquier parte del editor, cerramos el GIF.
        vscode.window.onDidChangeTextEditorSelection(e => {
            // Comprobamos si el clic fue intencionado (no solo movimiento del cursor)
            if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
                this.displayManager.hideGif();
            }
        });

        // 4. Listen for config changes to update AFK time
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('visualsgifs')) {
                console.log('[visualSgifs] Config updated. Resetting AFK timer.');
                this.resetAfkTimer(); // Reinicia el timer con el nuevo tiempo
            }
        });
    }

    /**
     * Resets the AFK timer.
     */
    /**
     * Resets the AFK timer.
     */
    private resetAfkTimer() {
        if (this.afkTimer) {
            clearTimeout(this.afkTimer);
        }

        // --- LÓGICA CORREGIDA ---
        // Ahora usa la configuración correcta de AFK
        const afkTimeInMs = this.configHelper.getAfkTimeInMs();
        // --- FIN DE LA CORRECCIÓN ---

        if (afkTimeInMs > 0) { // Solo activa el timer si el usuario ha puesto un tiempo
            this.afkTimer = setTimeout(() => {
                this.triggerGif('afk');
            }, afkTimeInMs);
        }
    }

    /**
     * Called when diagnostics (errors, warnings) change.
     */
    private onDiagnosticChange(diagnosticEvent: vscode.DiagnosticChangeEvent) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return; // No active file

        // Get diagnostics for the current active file
        const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
        
        // Find the first error
        const firstError = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);

        if (firstError) {
            // Check if it's a *new* error line we haven't reported yet
            if (firstError.range.start.line !== this.lastErrorLine) {
                this.lastErrorLine = firstError.range.start.line;
                console.log('[visualSgifs] New error detected.');
                this.triggerGif('error');
            }
        } else {
            // No errors in the file, reset the last error line
            this.lastErrorLine = -1;
        }
    }

    /**
     * The main function to find and show a GIF.
     * Es 'async' porque el proveedor y el mostrador lo son.
     */
    public async triggerGif(mood: 'afk' | 'error' | 'test') {
        try {
            // 1. Find a GIF path
            const gifPath = await this.gifProvider.getRandomGifPath(mood);
            if (!gifPath) {
                console.warn(`[visualSgifs] No GIF found for mood: ${mood}`);
                return;
            }

            // 2. Show the GIF
            await this.displayManager.showGif(gifPath);

        } catch (error) {
            console.error('[visualSgifs] Error triggering GIF:', error);
            vscode.window.showErrorMessage(`visualSgifs: An error occurred: ${error}`);
        }
    }
}