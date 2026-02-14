import type { FileItem as FileItemType } from '../../api';

interface ContextMenuProps {
    x: number;
    y: number;
    files: FileItemType[];
    onClose: () => void;
    onOpen: (e: React.MouseEvent, file: FileItemType) => void;
    onRename: () => void;
    onCopy: () => void;
    onMove: () => void;
    onSync: () => void;
    onDelete: () => void;
    onNewFolder: () => void;
    onSelectAll: () => void;
    hasFiles: boolean;
}

export function ContextMenu({
    x,
    y,
    files,
    onOpen,
    onRename,
    onCopy,
    onMove,
    onSync,
    onDelete,
    onNewFolder,
    onSelectAll,
    hasFiles,
}: ContextMenuProps) {
    return (
        <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 w-48 text-sm text-gray-700 dark:text-gray-200"
            style={{ top: y, left: x }}
            onClick={e => e.stopPropagation()}
        >
            {files.length > 0 ? (
                files.length === 1 ? (
                    /* Single-file menu */
                    <>
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-700 truncate">
                            {files[0].Name}
                        </div>
                        {files[0].IsDir ? (
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                                onClick={(e) => onOpen(e as any, files[0])}
                            >
                                Open
                            </button>
                        ) : (
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                                onClick={(e) => onOpen(e as any, files[0])}
                            >
                                Download
                            </button>
                        )}
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onRename}
                        >
                            Rename
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onCopy}
                        >
                            Copy to...
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onMove}
                        >
                            Move to...
                        </button>
                        {files[0].IsDir && (
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                                onClick={onSync}
                            >
                                Sync to...
                            </button>
                        )}
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                            onClick={onDelete}
                        >
                            Delete
                        </button>
                    </>
                ) : (
                    /* Multi-file menu */
                    <>
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-700">
                            {files.length} items selected
                        </div>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onCopy}
                        >
                            Copy to...
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onMove}
                        >
                            Move to...
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                            onClick={onDelete}
                        >
                            Delete
                        </button>
                    </>
                )
            ) : (
                /* Background menu */
                <>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                        onClick={onNewFolder}
                    >
                        New Folder
                    </button>
                    {hasFiles && (
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                            onClick={onSelectAll}
                        >
                            Select All
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
