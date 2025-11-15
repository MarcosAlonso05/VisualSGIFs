// src/LocalGifProvider.ts
import * as vscode from 'vscode';
import { promises as fs } from 'fs'; // Importamos 'fs/promises' como 'fs'
import { Dirent } from 'fs'; // Usamos 'fs/promises' para la versión asíncrona
import * as path from 'path';
import { ConfigHelper, GifMood } from './ConfigHelper';

export class LocalGifProvider {
    
    constructor(private configHelper: ConfigHelper) {}

    /**
     * Finds all matching GIFs and picks one at random.
     * Returns the full path to the GIF, or null if none is found.
     */
    public async getRandomGifPath(mood: GifMood): Promise<string | null> {
        
        // 1. Get configuration
        const folderPath = this.configHelper.getGifFolderPath();
        if (!folderPath) {
            vscode.window.showErrorMessage('visualSgifs: GIF Folder Path is not set. Please update your settings.');
            return null;
        }

        const tags = this.configHelper.getTagsForMood(mood);
        if (tags.length === 0) {
            console.warn(`[visualSgifs] No tags configured for mood: ${mood}`);
            return null;
        }
        
        // Pick one random tag from the list (e.g., "happy" from ["happy", "pat"])
        const tagToFind = tags[Math.floor(Math.random() * tags.length)];
        
        const activeSeries = this.configHelper.getActiveSeries();
        
        let allFoundGifs: string[] = [];

        // 2. Scan Root Folder (non-recursive)
        try {
            const rootGifs = await this.findGifsInDir(folderPath, tagToFind);
            allFoundGifs.push(...rootGifs);
        } catch (error) {
            console.error(`[visualSgifs] Error scanning root folder: ${folderPath}`, error);
        }

        // 3. Scan Active Series Folders (recursive)
        for (const series of activeSeries) {
            const seriesPath = path.join(folderPath, series);
            try {
                const seriesGifs = await this.findGifsInDirRecursive(seriesPath, tagToFind);
                allFoundGifs.push(...seriesGifs);
            } catch (error) {
                console.error(`[visualSgifs] Error scanning series folder: ${seriesPath}`, error);
            }
        }

        // 4. Select a final GIF
        if (allFoundGifs.length === 0) {
            console.warn(`[visualSgifs] No GIFs found for tag: ${tagToFind}`);
            return null;
        }

        const randomGifPath = allFoundGifs[Math.floor(Math.random() * allFoundGifs.length)];
        console.log(`[visualSgifs] Selected GIF: ${randomGifPath}`);
        return randomGifPath;
    }

    /**
     * Finds matching GIFs in a *single* directory (non-recursive).
     */
    private async findGifsInDir(dir: string, tag: string): Promise<string[]> {
        let dirents: Dirent[];
        try {
            dirents = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            // Folder probably doesn't exist, which is fine.
            return [];
        }

        const gifFiles = dirents
            .filter(dirent => 
                dirent.isFile() &&
                dirent.name.startsWith(`${tag}_`) &&
                dirent.name.endsWith('.gif')
            )
            .map(dirent => path.join(dir, dirent.name));

        return gifFiles;
    }

    /**
     * Finds matching GIFs in a directory *and all its subdirectories* (recursive).
     * This is used for 'k-on/' and 'k-on/yui/' etc.
     */
    private async findGifsInDirRecursive(dir: string, tag: string): Promise<string[]> {
        let foundGifs: string[] = [];
        let dirents: Dirent[];
        
        try {
            dirents = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            // Folder doesn't exist or isn't a directory.
            return [];
        }

        for (const dirent of dirents) {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                // It's a directory, go deeper
                const gifsInSubdir = await this.findGifsInDirRecursive(fullPath, tag);
                foundGifs.push(...gifsInSubdir);
            } else if (
                dirent.isFile() &&
                dirent.name.startsWith(`${tag}_`) &&
                dirent.name.endsWith('.gif')
            ) {
                // It's a matching file
                foundGifs.push(fullPath);
            }
        }
        return foundGifs;
    }
}