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
                group cursor-pointer rounded-lg border p-4 transition-all select-none
                ${isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md ring-1 ring-blue-500'
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow hover:border-blue-300'}
                ${isDragging ? 'opacity-40' : ''}
                ${isDropTarget ? 'ring-2 ring-blue-400 border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : ''}
                ${viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col items-center text-center'}
            `}
        >
            <div className={`flex ${viewMode === 'list' ? 'items-center gap-4 flex-grow' : 'flex-col items-center gap-2'} min-w-0 w-full`}>
                <div className="text-4xl text-blue-500 flex-shrink-0">
                    {file.IsDir ? (
                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                        </svg>
                    ) : (
                        <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
                <div className="min-w-0 w-full overflow-hidden">
                    <p className="font-medium text-gray-700 dark:text-gray-200 break-words line-clamp-2" title={file.Name}>
                        {file.Name}
                    </p>
                    {viewMode === 'grid' && (
                        <>
                            <p className="text-xs text-gray-400 mt-1">{formatSize(file.Size)}</p>
                            <p className="text-xs text-gray-400">{formatDate(file.ModTime)}</p>
                        </>
                    )}
                </div>
            </div>
            {viewMode === 'list' && (
                <div className="flex items-center gap-8 flex-shrink-0 ml-4 hidden md:flex">
                    <div className="text-sm text-gray-500 w-40 text-right">{formatDate(file.ModTime)}</div>
                    <div className="text-sm text-gray-500 w-20 text-right">{formatSize(file.Size)}</div>
                </div>
            )}
        </div>
    );
}
