import * as vscode from 'vscode';
import { ConfigHelper, GifPosition } from './ConfigHelper';
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

        // 1. Crear el CSS corregido con TRANSFORM
        const afterAttachment = this.createCursorFollowerAttachment(dataUri, maxWidth, maxHeight) as any;

        // 2. Configurar la decoración
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: afterAttachment,
            isWholeLine: false, // Vital: Falso para que se pegue al carácter
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed // Vital: Para que no se expanda al escribir
        });

        // 3. Pintar inicial
        this.updateGifPosition(editor);

        // 4. Activar el seguimiento del cursor
        this.cursorChangeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
            if (e.textEditor === editor && this.currentDecoration) {
                this.updateGifPosition(editor);
            }
        });

        if (durationMs > 0) {
            this.closeTimer = setTimeout(() => this.hideGif(), durationMs);
        }
    }

    private updateGifPosition(editor: vscode.TextEditor) {
        if (!this.currentDecoration) return;

        // Posición exacta del cursor
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
        // La magia está aquí:
        // No usamos 'left' ni 'top' como propiedades directas porque eso ancla a la ventana.
        // Usamos 'transform: translate(X, Y)' que mueve relativo al origen (el cursor).
        
        // X = 60px (a la derecha del cursor)
        // Y = -100% (hacia arriba, usando la propia altura de la imagen)
        
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