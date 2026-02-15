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
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-sm min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center p-8">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    </div>
                    <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Folder is empty</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Upload files or create folders to get started</p>
                </div>
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
