import { useState, useMemo } from 'react';
import type { FileItem } from '../../api';

type SortField = 'name' | 'size' | 'time';
type SortOrder = 'asc' | 'desc';

export function useFileSorting(files: FileItem[]) {
    const [sortBy, setSortBy] = useState<SortField>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => {
            if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
            let cmp = 0;
            switch (sortBy) {
                case 'name':
                    cmp = a.Name.localeCompare(b.Name);
                    break;
                case 'size':
                    cmp = a.Size - b.Size;
                    break;
                case 'time':
                    cmp = new Date(a.ModTime).getTime() - new Date(b.ModTime).getTime();
                    break;
            }
            return sortOrder === 'asc' ? cmp : -cmp;
        });
    }, [files, sortBy, sortOrder]);

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    return {
        sortedFiles,
        sortBy,
        sortOrder,
        toggleSort,
        setSortOrder,
    };
}
