import * as vscode from 'vscode';
import { ConfigHelper } from './ConfigHelper';
import { promises as fs } from 'fs';

export class GifDisplayManager implements vscode.Disposable {
    private configHelper: ConfigHelper;
    private currentDecoration: vscode.TextEditorDecorationType | null = null;
    private closeTimer: NodeJS.Timeout | null = null;
    private cursorChangeListener: vscode.Disposable | null = null;

    constructor(configHelper: ConfigHelper) {
        this.configHelper = configHelper;
    }

    public async showGif(gifPath: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        this.hideGif();

        const maxWidth = this.configHelper.getMaxWidth();
        const maxHeight = this.configHelper.getMaxHeight();
        const durationMs = this.configHelper.getDurationInMs();

        let gifData: Buffer;
        try {
            gifData = await fs.readFile(gifPath);
        } catch (error) {
            console.error('[visualSgifs] Failed to read GIF:', error);
            return;
        }

        const base64Data = gifData.toString('base64');
        const dataUri = `data:image/gif;base64,${base64Data}`;

        const afterAttachment = this.createCursorFollowerAttachment(dataUri, maxWidth, maxHeight) as any;

        // Decorator configure
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: afterAttachment,
            isWholeLine: false,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.updateGifPosition(editor);

        // Follow the cursor 
        this.cursorChangeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
            if (e.textEditor === editor && this.currentDecoration) {
                this.updateGifPosition(editor);
            }
        });

        if (durationMs > 0) {
            this.closeTimer = setTimeout(() => this.hideGif(), durationMs);
        }
    }

    // Update the decorator to show the gif in the cursor position
    private updateGifPosition(editor: vscode.TextEditor) {
        if (!this.currentDecoration) return;

        const position = editor.selection.active;
        const range = new vscode.Range(position, position);

        editor.setDecorations(this.currentDecoration, [range]);
    }

    public hideGif() {
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
        if (this.currentDecoration) {
            this.currentDecoration.dispose();
            this.currentDecoration = null;
        }
        if (this.cursorChangeListener) {
            this.cursorChangeListener.dispose();
            this.cursorChangeListener = null;
        }
    }

    public dispose() {
        this.hideGif();
    }

    private createCursorFollowerAttachment(
        dataUri: string,
        maxWidth: number,
        maxHeight: number
    ) { 
        return {
            contentText: '',
            textDecoration: `
                ; 
                display: inline-block;
                position: absolute; /* Saca el elemento del flujo para que NO empuje el texto */
                
                /* IMPORTANTE: NO definir 'left' ni 'top'. 
                   Al no definirlos, el 'absolute' empieza exactamente donde está el cursor. */

                /* MOVIMIENTO RELATIVO AL CURSOR */
                /* translate(X, Y) */
                /* 60px a la derecha, -${maxHeight}px hacia arriba */
                transform: translate(60px, -${maxHeight}px);

                /* TAMAÑO */
                width: ${maxWidth}px;
                height: ${maxHeight}px;
                
                /* IMAGEN */
                background-image: url("${dataUri}");
                background-size: contain;
                background-repeat: no-repeat;
                background-position: bottom left; 
                
                /* PROPIEDADES */
                pointer-events: none; /* Click fantasma */
                z-index: 1;
            `,
        };
    }
}