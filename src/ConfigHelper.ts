import * as vscode from 'vscode';

// Define the 'moods' or 'events' that can trigger a GIF.
export type GifMood = 'error' | 'afk' | 'test' | 'success';

export class ConfigHelper {

    // Helper function to get the extension's configuration.
    private getConfig() {
        return vscode.workspace.getConfiguration('visualsgifs');
    }

    // Gets the absolute path to the user's main GIF folder.
    public getGifFolderPath(): string | null {
        return this.getConfig().get<string | null>('gifFolderPath', null);
    }

    // Gets the list of active series (sub-folders).
    public getActiveSeries(): string[] {
        return this.getConfig().get<string[]>('activeSeries', []);
    }

    // Gets the configured AFK time in milliseconds.
    public getAfkTimeInMs(): number {
        const minutes = this.getConfig().get<number>('afk.timeInMinutes', 5);
        return minutes * 60 * 1000;
    }

    // Activation methods
    public isErrorEnabled(): boolean {
        return this.getConfig().get<boolean>('events.enableError', true);
    }

    public isAfkEnabled(): boolean {
        return this.getConfig().get<boolean>('events.enableAfk', true);
    }

    public isSuccessEnabled(): boolean {
        return this.getConfig().get<boolean>('events.enableSuccess', true);
    }

    // Gets the list of tags for a specific mood.
    public getTagsForMood(mood: GifMood): string[] {
        const configMap = {
            'error': 'tags.error',
            'afk': 'tags.afk',
            'test': 'tags.test',
            'success': 'tags.success'
        };
        const configKey = configMap[mood];
        return this.getConfig().get<string[]>(configKey, []);
    }

    // Gets the configured max width for the GIF.
    public getMaxWidth(): number {
        return this.getConfig().get<number>('display.maxWidth', 300);
    }

    // Gets the configured max height for the GIF.
    public getMaxHeight(): number {
        return this.getConfig().get<number>('display.maxHeight', 300);
    }

    // Gets the configured display duration in milliseconds.
    public getDurationInMs(): number {
        const seconds = this.getConfig().get<number>('display.durationSeconds', 5);
        return seconds * 1000;
    }

    // Waiting time before show error
    public getErrorDebounceTime(): number {
        return this.getConfig().get<number>('error.debounceTime', 3000);
    }
}