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

export type MediaKind = 'image' | 'video';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v', 'mkv'];

function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Detect whether a file can be previewed in the in-browser media viewer. */
export function getMediaKind(file: FileItem): MediaKind | null {
    if (file.IsDir) return null;
    const mime = (file.MimeType || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    // Fall back to the extension when the remote reports a generic mime type.
    const ext = fileExtension(file.Name);
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    return null;
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
