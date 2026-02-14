import type { FileItem as FileItemType } from '../../api';
import { FileItem } from './FileItem';

interface FileGridProps {
    files: FileItemType[];
    viewMode: 'grid' | 'list';
    selectedNames: Set<string>;
    draggedFiles: FileItemType[];
    dropTarget: string | null;
    currentPath: string;
    onFileClick: (e: React.MouseEvent, file: FileItemType, index: number) => void;
    onFileDoubleClick: (e: React.MouseEvent, file: FileItemType) => void;
    onContextMenu: (e: React.MouseEvent, file: FileItemType) => void;
    onDragStart: (e: React.DragEvent, file: FileItemType) => void;
    onDragEnd: () => void;
    onFolderDragOver: (e: React.DragEvent, folderName: string) => void;
    onFolderDragLeave: (e: React.DragEvent) => void;
    onFolderDrop: (e: React.DragEvent, folderPath: string) => void;
}

export function FileGrid({
    files,
    viewMode,
    selectedNames,
    draggedFiles,
    dropTarget,
    currentPath,
    onFileClick,
    onFileDoubleClick,
    onContextMenu,
    onDragStart,
    onDragEnd,
    onFolderDragOver,
    onFolderDragLeave,
    onFolderDrop,
}: FileGridProps) {
    if (files.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200">
                <p className="text-gray-400">Folder is empty</p>
            </div>
        );
    }

    return (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
            {files.map((file, index) => (
                <FileItem
                    key={file.Name}
                    file={file}
                    index={index}
                    viewMode={viewMode}
                    isSelected={selectedNames.has(file.Name)}
                    isDragging={draggedFiles.some(f => f.Name === file.Name)}
                    isDropTarget={file.IsDir && dropTarget === file.Name}
                    currentPath={currentPath}
                    onClick={onFileClick}
                    onDoubleClick={onFileDoubleClick}
                    onContextMenu={onContextMenu}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOver={file.IsDir ? onFolderDragOver : undefined}
                    onDragLeave={file.IsDir ? onFolderDragLeave : undefined}
                    onDrop={file.IsDir ? onFolderDrop : undefined}
                />
            ))}
        </div>
    );
}
