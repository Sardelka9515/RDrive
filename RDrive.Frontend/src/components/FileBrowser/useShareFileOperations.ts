import { useState, useCallback } from 'react';
import { api, type FileItem } from '../../api';
import { joinPath } from './utils';

interface UseShareFileOperationsProps {
    shareId: string | undefined;
    token: string | undefined;
    currentPath: string;
    onError: (message: string) => void;
    onReload: () => void;
}

/**
 * File write operations against a public, editable share. Mirrors useFileOperations but
 * targets the /p/shares/{id}/... endpoints (authenticated by the X-Share-Token header)
 * instead of the authenticated /api/remotes endpoints. No copy/move/sync.
 */
export function useShareFileOperations({
    shareId,
    token,
    currentPath,
    onError,
    onReload,
}: UseShareFileOperationsProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleUpload = useCallback(async (file: File) => {
        if (!shareId) return;
        setUploading(true);
        setUploadProgress(0);
        try {
            await api.uploadShareFile(shareId, currentPath, file, token, setUploadProgress);
            onReload();
        } catch (error: any) {
            onError(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [shareId, token, currentPath, onReload, onError]);

    const handleNewFolder = useCallback(async () => {
        if (!shareId) return;
        const name = prompt('Enter folder name:');
        if (!name) return;
        try {
            await api.createShareDirectory(shareId, joinPath(currentPath, name), token);
            onReload();
        } catch (error: any) {
            onError(`Failed to create folder: ${error.message}`);
        }
    }, [shareId, token, currentPath, onReload, onError]);

    const handleRename = useCallback(async (file: FileItem) => {
        if (!shareId) return;
        const newName = prompt('Enter new name:', file.Name);
        if (!newName || newName === file.Name) return;
        try {
            await api.renameShareFile(
                shareId,
                joinPath(currentPath, file.Name),
                joinPath(currentPath, newName),
                token,
                file.IsDir,
            );
            onReload();
        } catch (error: any) {
            onError(`Rename failed: ${error.message}`);
        }
    }, [shareId, token, currentPath, onReload, onError]);

    const handleDelete = useCallback(async (files: FileItem[]) => {
        if (!shareId || files.length === 0) return;
        const msg = files.length === 1
            ? `Are you sure you want to delete ${files[0].Name}?`
            : `Are you sure you want to delete ${files.length} items?`;
        if (!confirm(msg)) return;
        try {
            await Promise.all(files.map(f => api.deleteShareFile(shareId, joinPath(currentPath, f.Name), token)));
            onReload();
        } catch (error: any) {
            onError(`Delete failed: ${error.message}`);
            onReload();
        }
    }, [shareId, token, currentPath, onReload, onError]);

    return {
        uploading,
        uploadProgress,
        handleUpload,
        handleNewFolder,
        handleRename,
        handleDelete,
    };
}
