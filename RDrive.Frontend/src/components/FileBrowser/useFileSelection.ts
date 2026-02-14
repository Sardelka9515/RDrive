import { useState, useCallback } from 'react';
import type { FileItem } from '../../api';

export function useFileSelection(files: FileItem[]) {
    const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
    const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);

    const getSelectedItems = useCallback(
        () => files.filter(f => selectedNames.has(f.Name)),
        [files, selectedNames],
    );

    const handleFileClick = useCallback((
        e: React.MouseEvent,
        file: FileItem,
        index: number,
        sortedFiles: FileItem[]
    ) => {
        e.stopPropagation();
        
        if (e.ctrlKey || e.metaKey) {
            setSelectedNames(prev => {
                const next = new Set(prev);
                next.has(file.Name) ? next.delete(file.Name) : next.add(file.Name);
                return next;
            });
            setLastClickedIdx(index);
        } else if (e.shiftKey && lastClickedIdx !== null) {
            const lo = Math.min(lastClickedIdx, index);
            const hi = Math.max(lastClickedIdx, index);
            setSelectedNames(prev => {
                const next = new Set(prev);
                for (let i = lo; i <= hi; i++) next.add(sortedFiles[i].Name);
                return next;
            });
        } else {
            setSelectedNames(new Set([file.Name]));
            setLastClickedIdx(index);
        }
    }, [lastClickedIdx]);

    const selectAll = useCallback(() => {
        setSelectedNames(new Set(files.map(f => f.Name)));
    }, [files]);

    const clearSelection = useCallback(() => {
        setSelectedNames(new Set());
        setLastClickedIdx(null);
    }, []);

    const selectSingle = useCallback((fileName: string) => {
        setSelectedNames(new Set([fileName]));
    }, []);

    return {
        selectedNames,
        getSelectedItems,
        handleFileClick,
        selectAll,
        clearSelection,
        selectSingle,
    };
}
