import type { FileItem as FileItemType } from '../../api';
import { formatSize, formatDate } from './utils';

interface FileItemProps {
    file: FileItemType;
    index: number;
    viewMode: 'grid' | 'list';
    isSelected: boolean;
    isDragging: boolean;
    isDropTarget: boolean;
    onClick: (e: React.MouseEvent, file: FileItemType, index: number) => void;
    onDoubleClick: (e: React.MouseEvent, file: FileItemType) => void;
    onContextMenu: (e: React.MouseEvent, file: FileItemType) => void;
    onDragStart: (e: React.DragEvent, file: FileItemType) => void;
    onDragEnd: () => void;
    onDragOver?: (e: React.DragEvent, folderName: string) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent, folderPath: string) => void;
    currentPath: string;
}

export function FileItem({
    file,
    index,
    viewMode,
    isSelected,
    isDragging,
    isDropTarget,
    onClick,
    onDoubleClick,
    onContextMenu,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    currentPath,
}: FileItemProps) {
    const folderPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;

    return (
        <div
            draggable
            onClick={e => onClick(e, file, index)}
            onDoubleClick={e => onDoubleClick(e, file)}
            onContextMenu={e => onContextMenu(e, file)}
            onDragStart={e => onDragStart(e, file)}
            onDragEnd={onDragEnd}
            onDragOver={file.IsDir && onDragOver ? (e => onDragOver(e, file.Name)) : undefined}
            onDragLeave={file.IsDir && onDragLeave ? onDragLeave : undefined}
            onDrop={file.IsDir && onDrop ? (e => onDrop(e, folderPath)) : undefined}
            className={`
                group cursor-pointer rounded-xl border p-4 transition-all duration-200 select-none
                ${isSelected
                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-500 dark:border-blue-600 shadow-lg ring-2 ring-blue-500/50 dark:ring-blue-400/50 scale-[1.02]'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 hover:scale-[1.01]'}
                ${isDragging ? 'opacity-40' : ''}
                ${isDropTarget ? 'ring-4 ring-blue-400 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.03] shadow-xl' : ''}
                ${viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col items-center text-center'}
            `}
        >
            <div className={`flex ${viewMode === 'list' ? 'items-center gap-4 flex-grow' : 'flex-col items-center gap-2'} min-w-0 w-full`}>
                <div className={`flex-shrink-0 ${file.IsDir ? 'text-blue-500' : 'text-gray-400'}`}>
                    {file.IsDir ? (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                            </svg>
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-7 h-7 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </div>
                <div className="min-w-0 w-full overflow-hidden">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 break-words line-clamp-2" title={file.Name}>
                        {file.Name}
                    </p>
                    {viewMode === 'grid' && (
                        <>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 font-medium">{formatSize(file.Size)}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(file.ModTime)}</p>
                        </>
                    )}
                </div>
            </div>
            {viewMode === 'list' && (
                <div className="flex items-center gap-8 flex-shrink-0 ml-4 hidden md:flex">
                    <div className="text-sm text-gray-500 dark:text-gray-400 w-40 text-right font-medium">{formatDate(file.ModTime)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 w-20 text-right font-semibold">{formatSize(file.Size)}</div>
                </div>
            )}
        </div>
    );
}
