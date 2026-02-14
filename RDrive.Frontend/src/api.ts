export interface FileItem {
    Path: string;
    Name: string;
    Size: number;
    MimeType: string;
    ModTime: string;
    IsDir: boolean;
    ID: string;
}

export interface TransferringItem {
    bytes: number;
    eta: number | null;
    group: string;
    name: string;
    percentage: number;
    size: number;
    speed: number;
    speedAvg: number;
}

export interface TransferStats {
    bytes: number;
    checks: number;
    deletedDirs: number;
    deletes: number;
    elapsedTime: number;
    errors: number;
    eta: number | null;
    fatalError: boolean;
    renames: number;
    retryError: boolean;
    speed: number;
    totalBytes: number;
    totalChecks: number;
    totalTransfers: number;
    transferTime: number;
    transfers: number;
    transferring: TransferringItem[] | null;
}

export interface RTask {
    id: string;
    rcloneJobId: number;
    type: string;       // Sync, Copy, Move
    status: string;     // Queued, Pending, Running, Completed, Failed, Stopped, Unknown
    isDir: boolean;
    sourceRemote: string;
    sourcePath: string;
    destRemote: string;
    destPath: string;
    error: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    stats: TransferStats | null;
}

export interface ProviderOption {
    Name: string;
    FieldName: string;
    Help: string;
    Provider: string;
    Default: any;
    Examples: { Value: string; Help: string; Provider: string }[] | null;
    Required: boolean;
    IsPassword: boolean;
    Advanced: boolean;
    Exclusive: boolean;
    Sensitive: boolean;
    Hide: number;
    NoPrefix: boolean;
}

export interface Provider {
    Name: string;
    Description: string;
    Prefix: string;
    Options: ProviderOption[];
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Token getter, set by AuthProvider
let _getToken: (() => Promise<string | null>) | null = null;
let _accessDeniedHandler: ((denied: boolean) => void) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
    _getToken = getter;
}

export function setAccessDeniedHandler(handler: (denied: boolean) => void) {
    _accessDeniedHandler = handler;
}

async function authHeaders(): Promise<Record<string, string>> {
    if (!_getToken) return {};
    const token = await _getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = await authHeaders();
    const res = await fetch(url, {
        ...init,
        headers: { ...headers, ...init?.headers },
    });
    
    // Notify auth provider of access denied status
    if (res.status === 401 || res.status === 403) {
        _accessDeniedHandler?.(true);
    }
    
    return res;
}

export const api = {
    getRemotes: async (): Promise<string[]> => {
        const res = await authFetch(`${API_BASE}/remotes`);
        if (!res.ok) throw new Error('Failed to fetch remotes');
        return res.json();
    },

    listFiles: async (remoteName: string, path: string = '', signal?: AbortSignal): Promise<FileItem[]> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files?path=${encodeURIComponent(path)}`, { signal });
        if (!res.ok) throw new Error('Failed to fetch files');
        return res.json();
    },

    uploadFile: (remoteName: string, parentPath: string, file: File, onProgress?: (progress: number) => void): Promise<void> => {
        return new Promise(async (resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);

            const cleanParentPath = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
            const fullPath = cleanParentPath ? `${cleanParentPath}/${file.name}` : file.name;

            const xhr = new XMLHttpRequest();
            // Encode each segment of the path individually to preserve slashes
            const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
            xhr.open('POST', `${API_BASE}/remotes/${remoteName}/files/upload/${encodedPath}`);

            // Attach auth token
            const headers = await authHeaders();
            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(xhr.responseText || 'Failed to upload file'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));

            xhr.send(formData);
        });
    },

    deleteFile: async (remoteName: string, path: string): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files/${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to delete item');
        }
    },

    copyFile: async (remoteName: string, path: string, dstRemote: string, dstPath: string, isDir: boolean = false): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files/copy/${encodeURIComponent(path)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ DestinationRemote: dstRemote, DestinationPath: dstPath, IsDir: isDir })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to copy item');
        }
        return res.json();
    },

    moveFile: async (remoteName: string, path: string, dstRemote: string, dstPath: string, isDir: boolean = false): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files/move/${encodeURIComponent(path)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ DestinationRemote: dstRemote, DestinationPath: dstPath, IsDir: isDir })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to move item');
        }
        return res.json();
    },

    renameFile: async (remoteName: string, path: string, newPath: string): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files/rename/${encodeURIComponent(path)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ NewPath: newPath })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to rename item');
        }
    },

    startSync: async (srcRemote: string, srcPath: string, dstRemote: string, dstPath: string): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/tasks/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ SourceRemote: srcRemote, SourcePath: srcPath, DestRemote: dstRemote, DestPath: dstPath })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to start sync task');
        }
        return res.json();
    },

    createDirectory: async (remoteName: string, path: string): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes/${remoteName}/files/mkdir/${encodeURIComponent(path)}`, {
            method: 'POST'
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to create directory');
        }
    },

    // Jobs / Tasks API
    getTasks: async (): Promise<RTask[]> => {
        const res = await authFetch(`${API_BASE}/tasks`);
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return res.json();
    },

    getTask: async (id: string): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/tasks/${id}`);
        if (!res.ok) throw new Error('Failed to fetch task');
        return res.json();
    },

    stopTask: async (id: string): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/tasks/${id}/stop`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to stop task');
        return res.json();
    },

    deleteTask: async (id: string): Promise<void> => {
        const res = await authFetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete task');
    },

    restartTask: async (id: string): Promise<RTask> => {
        const res = await authFetch(`${API_BASE}/tasks/${id}/restart`, { method: 'POST' });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to restart task');
        }
        return res.json();
    },

    clearCompletedTasks: async (): Promise<void> => {
        const res = await authFetch(`${API_BASE}/tasks`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to clear tasks');
    },

    // Remote config management
    getProviders: async (): Promise<Provider[]> => {
        const res = await authFetch(`${API_BASE}/remotes/providers`);
        if (!res.ok) throw new Error('Failed to fetch providers');
        return res.json();
    },

    getRemoteConfig: async (name: string): Promise<Record<string, string>> => {
        const res = await authFetch(`${API_BASE}/remotes/${encodeURIComponent(name)}/config`);
        if (!res.ok) throw new Error('Failed to fetch remote config');
        return res.json();
    },

    createRemote: async (name: string, type: string, parameters: Record<string, string>): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, parameters })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to create remote');
        }
    },

    updateRemote: async (name: string, parameters: Record<string, string>): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes/${encodeURIComponent(name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameters })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to update remote');
        }
    },

    deleteRemote: async (name: string): Promise<void> => {
        const res = await authFetch(`${API_BASE}/remotes/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to delete remote');
        }
    },

    dumpConfig: async (): Promise<Record<string, Record<string, string>>> => {
        const res = await authFetch(`${API_BASE}/remotes/dump`);
        if (!res.ok) throw new Error('Failed to dump config');
        return res.json();
    }
};
