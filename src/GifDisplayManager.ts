import * as vscode from 'vscode';
import { ConfigHelper, GifPosition } from './ConfigHelper';
import { promises as fs } from 'fs';

// Implement vscode.Disposable to ensure cleanup
export class GifDisplayManager implements vscode.Disposable {
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

        // Clean previous GIF before showing a new one
        this.hideGif();

        const position = this.configHelper.getPosition();
        const maxWidth = this.configHelper.getMaxWidth();
        const maxHeight = this.configHelper.getMaxHeight();
        const durationMs = this.configHelper.getDurationInMs();

        // Read GIF and convert to Base64
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

        const afterAttachment = this.createAfterAttachment(dataUri, position, maxWidth, maxHeight) as any;

        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: afterAttachment,
            isWholeLine: true,
        });

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

    // Required by vscode.Disposable
    public dispose() {
        this.hideGif();
    }

    private createAfterAttachment(
        dataUri: string,
        position: GifPosition,
        maxWidth: number,
        maxHeight: number
    ) {
        const base: {
            contentText: string;
            margin?: string;
            height?: string;
            width?: string;
            textDecoration?: string;
        } = {
            contentText: '',
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