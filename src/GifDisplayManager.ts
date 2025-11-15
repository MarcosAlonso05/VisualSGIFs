// src/GifDisplayManager.ts
import * as vscode from 'vscode';
import { ConfigHelper, GifPosition } from './ConfigHelper';
import { promises as fs } from 'fs';

export class GifDisplayManager {
    private configHelper: ConfigHelper;
    private currentDecoration: vscode.TextEditorDecorationType | null = null;
    private closeTimer: NodeJS.Timeout | null = null;

    constructor(configHelper: ConfigHelper) {
        this.configHelper = configHelper;
    }

    public async showGif(gifPath: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.warn('[visualSgifs] No active editor.');
            return;
        }

        this.hideGif();

        const position = this.configHelper.getPosition();
        const maxWidth = this.configHelper.getMaxWidth();
        const maxHeight = this.configHelper.getMaxHeight();
        const durationMs = this.configHelper.getDurationInMs();

        // Leer GIF y convertirlo a Base64
        let gifData: Buffer;
        try {
            gifData = await fs.readFile(gifPath);
        } catch (error) {
            console.error('[visualSgifs] Failed to read GIF:', error);
            vscode.window.showErrorMessage(`visualSgifs: Failed to read GIF file at ${gifPath}`);
            return;
        }

        const base64Data = gifData.toString('base64');
        const dataUri = `data:image/gif;base64,${base64Data}`;

        // Crear el objeto "after" que acepta VS Code (cast a any para evitar errores de tipo TS)
        const afterAttachment = this.createAfterAttachment(dataUri, position, maxWidth, maxHeight) as any;

        // Crear la decoración usando el objeto correcto
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: afterAttachment,
            isWholeLine: true,
        });

        // Aplicar la decoración en una línea visible (línea actual para mayor seguridad)
        const line = Math.max(0, editor.selection.active.line);
        const range = new vscode.Range(line, 0, line, 0);
        editor.setDecorations(this.currentDecoration, [range]);

        if (durationMs > 0) {
            this.closeTimer = setTimeout(() => this.hideGif(), durationMs);
        }
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
    }

    /**
     * Devuelve el objeto que se asignará a la propiedad `after` de DecorationRenderOptions.
     * Se modela como un attachment con contentText y textDecoration (background-image).
     */
    private createAfterAttachment(
        dataUri: string,
        position: GifPosition,
        maxWidth: number,
        maxHeight: number
    ) {
        // Usamos contentText vacío y textDecoration para incrustar la imagen
        // margin, width y height son aceptados por la API en el "after" attachment
        const base: {
            contentText: string;
            margin?: string;
            height?: string;
            width?: string;
            textDecoration?: string;
            // tooltip?: string; // si quieres tooltip
        } = {
            contentText: '',
            // margen para intentar separarlo visualmente; aquí controlamos solo orientación básica
            margin: position === 'top-right' || position === 'bottom-right' ? '0 0 0 16px' : '0 16px 0 0',
            width: `${maxWidth}px`,
            height: `${maxHeight}px`,
            textDecoration: `
                ; display: inline-block;
                vertical-align: middle;
                width: ${maxWidth}px;
                height: ${maxHeight}px;
                background-image: url("${dataUri}");
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center center;
            `,
        };

        return base;
    }
}
