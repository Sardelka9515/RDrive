import { useState, useCallback } from 'react';
import { api, type FileItem } from '../../api';
import { joinPath } from './utils';

interface UseFileOperationsProps {
    remoteName: string | undefined;
    currentPath: string;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    onReload: () => void;
}

export function useFileOperations({
    remoteName,
    currentPath,
    onSuccess,
    onError,
    onReload,
}: UseFileOperationsProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleUpload = useCallback(async (file: File) => {
        if (!remoteName) return;
        setUploading(true);
        setUploadProgress(0);
        try {
            await api.uploadFile(remoteName, currentPath, file, setUploadProgress);
            onReload();
        } catch (error: any) {
            onError(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [remoteName, currentPath, onReload, onError]);

    const handleNewFolder = useCallback(async () => {
        if (!remoteName) return;
        const name = prompt('Enter folder name:');
        if (!name) return;
        const target = joinPath(currentPath, name);
        try {
            await api.createDirectory(remoteName, target);
            onReload();
        } catch (error: any) {
            onError(`Failed to create folder: ${error.message}`);
        }
    }, [remoteName, currentPath, onReload, onError]);

    const handleRename = useCallback(async (file: FileItem) => {
        if (!remoteName) return;
        const newName = prompt('Enter new name:', file.Name);
        if (!newName || newName === file.Name) return;
        const srcPath = joinPath(currentPath, file.Name);
        const dstPath = joinPath(currentPath, newName);
        try {
            await api.renameFile(remoteName, srcPath, dstPath, file.IsDir);
            onReload();
        } catch (error: any) {
            onError(`Rename failed: ${error.message}`);
        }
    }, [remoteName, currentPath, onReload, onError]);

    const handleDelete = useCallback(async (files: FileItem[]) => {
        if (!remoteName || files.length === 0) return;
        const msg = files.length === 1
            ? `Are you sure you want to delete ${files[0].Name}?`
            : `Are you sure you want to delete ${files.length} items?`;
        if (!confirm(msg)) return;
        try {
            await Promise.all(files.map(f => {
                const targetPath = joinPath(currentPath, f.Name);
                return api.deleteFile(remoteName, targetPath);
            }));
            onReload();
        } catch (error: any) {
            onError(`Delete failed: ${error.message}`);
            onReload();
        }
    }, [remoteName, currentPath, onReload, onError]);

    const handleCopyMove = useCallback(async (
        type: 'copy' | 'move' | 'sync',
        files: FileItem[],
        dstRemote: string,
        dstPath: string,
    ) => {
        if (!remoteName || files.length === 0) return;
        try {
            for (const file of files) {
                const srcPath = joinPath(currentPath, file.Name);
                const fileDst = files.length === 1
                    ? dstPath
                    : joinPath(dstPath, file.Name);
                
                if (type === 'copy') {
                    await api.copyFile(remoteName, srcPath, dstRemote, fileDst, file.IsDir);
                } else if (type === 'move') {
                    await api.moveFile(remoteName, srcPath, dstRemote, fileDst, file.IsDir);
                } else if (type === 'sync') {
                    await api.startSync(remoteName, srcPath, dstRemote, fileDst);
                }
            }
            const n = files.length;
            const op = type.charAt(0).toUpperCase() + type.slice(1);
            onSuccess(`${op} job${n > 1 ? 's' : ''} started. Check the Jobs page for progress.`);
            if (type === 'move') onReload();
        } catch (error: any) {
            onError(`Operation failed: ${error.message}`);
        }
    }, [remoteName, currentPath, onSuccess, onError, onReload]);

    const handleMove = useCallback(async (files: FileItem[], targetPath: string) => {
        if (!remoteName || files.length === 0) return;
        if (targetPath === currentPath) return;
        try {
            for (const file of files) {
                const srcPath = joinPath(currentPath, file.Name);
                const dst = joinPath(targetPath, file.Name);
                if (srcPath === dst) continue;
                await api.renameFile(remoteName, srcPath, dst, file.IsDir);
            }
            onReload();
        } catch (error: any) {
            onError(`Move failed: ${error.message}`);
            onReload();
        }
    }, [remoteName, currentPath, onReload, onError]);

    return {
        uploading,
        uploadProgress,
        handleUpload,
        handleNewFolder,
        handleRename,
        handleDelete,
        handleCopyMove,
        handleMove,
    };
}
