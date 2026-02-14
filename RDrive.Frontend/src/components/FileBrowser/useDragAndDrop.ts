import { useState, useCallback } from 'react';
import type { FileItem } from '../../api';

export function useDragAndDrop(
    selectedNames: Set<string>,
    getSelectedItems: () => FileItem[],
    selectSingle: (name: string) => void,
) {
    const [draggedFiles, setDraggedFiles] = useState<FileItem[]>([]);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, file: FileItem) => {
        let items: FileItem[];
        if (selectedNames.has(file.Name)) {
            items = getSelectedItems();
        } else {
            selectSingle(file.Name);
            items = [file];
        }
        setDraggedFiles(items);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-rdrive-files', JSON.stringify(items.map(f => f.Name)));
        
        // Custom drag image showing count
        if (items.length > 1) {
            const el = document.createElement('div');
            el.textContent = `${items.length} items`;
            el.style.cssText =
                'position:fixed;top:-1000px;background:#2563eb;color:white;padding:4px 12px;border-radius:8px;font-size:14px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)';
            document.body.appendChild(el);
            e.dataTransfer.setDragImage(el, 0, 0);
            requestAnimationFrame(() => document.body.removeChild(el));
        }
    }, [selectedNames, getSelectedItems, selectSingle]);

    const handleFolderDragOver = useCallback((e: React.DragEvent, folderName: string) => {
        if (draggedFiles.length === 0) return;
        if (draggedFiles.some(f => f.Name === folderName)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(folderName);
    }, [draggedFiles]);

    const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (!e.currentTarget.contains(related)) {
            setDropTarget(null);
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedFiles([]);
        setDropTarget(null);
    }, []);

    const clearDragState = useCallback(() => {
        setDraggedFiles([]);
        setDropTarget(null);
    }, []);

    return {
        draggedFiles,
        dropTarget,
        setDropTarget,
        handleDragStart,
        handleFolderDragOver,
        handleFolderDragLeave,
        handleDragEnd,
        clearDragState,
    };
}
