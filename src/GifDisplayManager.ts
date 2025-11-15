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
            vscode.window.showErrorMessage(`Error reading GIF: ${gifPath}`);
            return;
        }

        const base64Data = gifData.toString('base64');
        const dataUri = `data:image/gif;base64,${base64Data}`;

        // Crear CSS seguro para Decorations
        const css = this.createDecorationCss(
            dataUri,
            position,
            maxWidth,
            maxHeight
        );

        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: css,
            isWholeLine: true,
        });

        // Mostrar en la línea 0
        const range = new vscode.Range(0, 0, 0, 0);
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

    private createDecorationCss(
        dataUri: string,
        position: GifPosition,
        maxWidth: number,
        maxHeight: number
    ): vscode.DecorationRenderOptions {

        // Estas decoraciones SIEMPRE funcionan
        const css: vscode.DecorationRenderOptions = {
            contentText: '',
            margin: '20px 0 0 0',
            textDecoration: `
                ; display: inline-block;
                width: ${maxWidth}px;
                height: ${maxHeight}px;
                background-image: url(${dataUri});
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center center;
            `,
        };

        // Ajuste básico de posición horizontal (lo máximo permitido)
        if (position === 'top-right' || position === 'bottom-right') {
            css.margin = '20px 0 0 auto';
        } else {
            css.margin = '20px 0 0 0';
        }

        return css;
    }
}
