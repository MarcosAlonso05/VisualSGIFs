// src/GifDisplayManager.ts
import * as vscode from 'vscode';
import { ConfigHelper, GifPosition } from './ConfigHelper';
import { promises as fs } from 'fs'; // Importamos 'fs' para leer el archivo

export class GifDisplayManager {
    private configHelper: ConfigHelper;
    private currentDecoration: vscode.TextEditorDecorationType | null = null;
    private closeTimer: NodeJS.Timeout | null = null;

    constructor(configHelper: ConfigHelper) {
        this.configHelper = configHelper;
    }

    /**
     * Shows a GIF as a decoration in the active editor.
     * Esta función es 'async' ahora para poder leer el archivo.
     */
    public async showGif(gifPath: string) {
        // 1. Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.warn('[visualSgifs] No active editor to show GIF in.');
            return;
        }

        // 2. Clear any existing GIF and its timer
        this.hideGif();

        // 3. Get all display configurations
        const position = this.configHelper.getPosition();
        const maxWidth = this.configHelper.getMaxWidth();
        const maxHeight = this.configHelper.getMaxHeight();
        const durationMs = this.configHelper.getDurationInMs();

        // 4. *** NUEVA LÓGICA: LEER ARCHIVO Y CONVERTIR A BASE64 ***
        let gifData: Buffer;
        try {
            gifData = await fs.readFile(gifPath);
        } catch (error) {
            console.error('[visualSgifs] Failed to read GIF file:', error);
            vscode.window.showErrorMessage(`visualSgifs: Failed to read GIF file at ${gifPath}`);
            return;
        }
        
        // Convertir el buffer a string Base64
        const base64Data = gifData.toString('base64');
        const dataUri = `data:image/gif;base64,${base64Data}`;
        // *** FIN DE LA NUEVA LÓGICA ***

        // 5. Create the CSS for the decoration
        const decorationCss = this.createDecorationCss(
            dataUri, // Usamos el dataUri en lugar del webviewUri
            position,
            maxWidth,
            maxHeight
        );

        // 6. Create the decoration type
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            // 'after' espera un objeto de tipo 'DecorationRenderOptions'
            after: decorationCss,
            isWholeLine: true,
        });

        // 7. Apply the decoration
        const range = new vscode.Range(0, 0, 0, 0);
        editor.setDecorations(this.currentDecoration, [range]);

        // 8. Set timer to close it
        if (durationMs > 0) {
            this.closeTimer = setTimeout(() => {
                this.hideGif();
            }, durationMs);
        }
    }

    /**
     * Removes the currently displayed GIF decoration.
     */
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
     * Generates the CSS object for the decoration's pseudo-element.
     * Ahora devuelve el tipo correcto: 'DecorationRenderOptions'
     */
    private createDecorationCss(
        dataUri: string, // <-- Cambiado de webviewUri a dataUri
        position: GifPosition,
        maxWidth: number,
        maxHeight: number
    ): vscode.DecorationRenderOptions { // <-- TIPO CORREGIDO
        
        // Base CSS for the GIF
        const baseStyles: { [key: string]: string } = {
            'content': `''`, 
            'background-image': `url(${dataUri})`, // <-- Usamos el dataUri
            'background-size': 'contain',
            'background-repeat': 'no-repeat',
            'background-position': 'center center',
            'position': 'absolute',
            'pointer-events': 'auto', // Lo cambiamos a 'auto' para el clic
            'z-index': '100',
            'width': `${maxWidth}px`,
            'height': `${maxHeight}px`,
            'max-width': `${maxWidth}px`,
            'max-height': `${maxHeight}px`,
            'font-size': '0px', // Hack para que el 'after' tenga 'cuerpo'
        };

        // Add position styles
        const margin = '20px'; 
        switch (position) {
            case 'top-left':
                baseStyles['top'] = margin;
                baseStyles['left'] = margin;
                break;
            case 'top-right':
                baseStyles['top'] = margin;
                baseStyles['right'] = margin;
                break;
            case 'bottom-left':
                baseStyles['bottom'] = margin;
                baseStyles['left'] = margin;
                break;
            case 'bottom-right':
                baseStyles['bottom'] = margin;
                baseStyles['right'] = margin;
                break;
        }

        // El objeto 'baseStyles' coincide con la estructura de 'DecorationRenderOptions'
        return baseStyles as vscode.DecorationRenderOptions;
    }
}