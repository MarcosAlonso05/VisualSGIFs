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

        // 1. Generate CSS attachment
        const afterAttachment = this.createCursorFollowerAttachment(dataUri, maxWidth, maxHeight) as any;

        // 2. Create Decoration
        // We set isWholeLine to FALSE so it anchors to the specific cursor character
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            after: afterAttachment,
            isWholeLine: false,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 3. Initial Paint
        this.updateGifPosition(editor);

        // 4. Start Cursor Listener
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

        // Get the exact cursor position
        const position = editor.selection.active;
        
        // Create a range of zero length at the cursor position
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
        // Calculate negative top to pull the image UP.
        // We use the image height to pull it up so it sits exactly on top of the text.
        // We add a few pixels (-5px) to give it a tiny bit of padding from the text.
        const topOffset = maxHeight; 

        return {
            contentText: '',
            textDecoration: `
                ; 
                display: inline-block;
                position: absolute;
                
                /* HORIZONTAL POSITION: */
                /* Move it 10px to the RIGHT of the cursor so it doesn't block text */
                left: 10px;
                
                /* VERTICAL POSITION: */
                /* This is the key fix. We pull it UP by its own height. */
                /* top: 0 would be the underline of the text. */
                /* top: -300px (example) moves it above the line. */
                top: -${topOffset}px;

                /* SIZE */
                width: ${maxWidth}px;
                height: ${maxHeight}px;
                
                /* IMAGE */
                background-image: url("${dataUri}");
                background-size: contain;
                background-repeat: no-repeat;
                background-position: bottom left; /* Anchor image to bottom-left of its box */
                
                /* BEHAVIOR */
                pointer-events: none;
                z-index: 1;
            `,
        };
    }
}