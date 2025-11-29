import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { Dirent } from 'fs';
import * as path from 'path';
import { ConfigHelper, GifMood } from './ConfigHelper';

export class LocalGifProvider {
    
    constructor(private configHelper: ConfigHelper) {}

    // Finds all matching GIFs and picks one at random. Returns the full path to the GIF, or null if none is found.
    public async getRandomGifPath(mood: GifMood): Promise<string | null> {
        
        // Get configuration
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

        // Scan Root Folder (non-recursive)
        try {
            const rootGifs = await this.findGifsInDir(folderPath, tagToFind);
            allFoundGifs.push(...rootGifs);
        } catch (error) {
            console.error(`[visualSgifs] Error scanning root folder: ${folderPath}`, error);
        }

        // Scan Active Series Folders (recursive)
        for (const series of activeSeries) {
            const seriesPath = path.join(folderPath, series);
            try {
                const seriesGifs = await this.findGifsInDirRecursive(seriesPath, tagToFind);
                allFoundGifs.push(...seriesGifs);
            } catch (error) {
                console.error(`[visualSgifs] Error scanning series folder: ${seriesPath}`, error);
            }
        }

        // Select a final GIF
        if (allFoundGifs.length === 0) {
            console.warn(`[visualSgifs] No GIFs found for tag: ${tagToFind}`);
            return null;
        }

        const randomGifPath = allFoundGifs[Math.floor(Math.random() * allFoundGifs.length)];
        console.log(`[visualSgifs] Selected GIF: ${randomGifPath}`);
        return randomGifPath;
    }

    // Finds matching GIFs in a *single* directory (non-recursive).
    private async findGifsInDir(dir: string, tag: string): Promise<string[]> {
        let dirents: Dirent[];
        try {
            dirents = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
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

    // Finds matching GIFs in a directory *and all its subdirectories*
    private async findGifsInDirRecursive(dir: string, tag: string): Promise<string[]> {
        let foundGifs: string[] = [];
        let dirents: Dirent[];
        
        try {
            dirents = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            return [];
        }

        for (const dirent of dirents) {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                const gifsInSubdir = await this.findGifsInDirRecursive(fullPath, tag);
                foundGifs.push(...gifsInSubdir);
            } else if (
                dirent.isFile() &&
                dirent.name.startsWith(`${tag}_`) &&
                dirent.name.endsWith('.gif')
            ) {
                foundGifs.push(fullPath);
            }
        }
        return foundGifs;
    }
}