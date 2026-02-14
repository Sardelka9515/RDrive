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
