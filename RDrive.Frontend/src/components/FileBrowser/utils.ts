import type { FileItem } from '../../api';

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateStr: string): string {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return '-';
    return new Date(dateStr).toLocaleString();
}

export function parseBreadcrumbs(path: string): string[] {
    return path.split('/').filter(Boolean);
}

export function buildPath(segments: string[]): string {
    return segments.join('/');
}

export function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/');
}

/** A FileItem that represents the folder currently being viewed (incl. the remote root). */
export interface CurrentDirItem extends FileItem {
    isCurrentDir: true;
}

export function isCurrentDirItem(file: FileItem): file is CurrentDirItem {
    return (file as CurrentDirItem).isCurrentDir === true;
}

/**
 * Build a synthetic item for the directory currently open in the browser so it can be
 * used as the source of a copy/move/sync without navigating to its parent to select it.
 * For the remote root (empty path) the remote name is used as the display name.
 */
export function makeCurrentDirItem(remoteName: string, currentPath: string): CurrentDirItem {
    const name = currentPath ? currentPath.split('/').filter(Boolean).pop() ?? remoteName : remoteName;
    return {
        Name: name,
        Path: currentPath,
        Size: 0,
        MimeType: 'inode/directory',
        ModTime: '',
        IsDir: true,
        ID: '',
        isCurrentDir: true,
    };
}
