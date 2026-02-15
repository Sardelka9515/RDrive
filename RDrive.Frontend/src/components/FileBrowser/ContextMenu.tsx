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
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 w-56 text-sm text-gray-700 dark:text-gray-200 animate-fade-in"
            style={{ top: y, left: x }}
            onClick={e => e.stopPropagation()}
        >
            {files.length > 0 ? (
                files.length === 1 ? (
                    /* Single-file menu */
                    <>
                        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent truncate text-gray-900 dark:text-white">
                            {files[0].Name}
                        </div>
                        {files[0].IsDir ? (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2 font-medium"
                                onClick={(e) => onOpen(e as any, files[0])}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                                Open
                            </button>
                        ) : (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2 font-medium"
                                onClick={(e) => onOpen(e as any, files[0])}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                Download
                            </button>
                        )}
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onRename}
                        >
                            Rename
                        </button>
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onCopy}
                        >
                            Copy to...
                        </button>
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onMove}
                        >
                            Move to...
                        </button>
                        {files[0].IsDir && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onSync}
                            >
                                Sync to...
                            </button>
                        )}
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-all font-medium"
                            onClick={onDelete}
                        >
                            Delete
                        </button>
                    </>
                ) : (
                    /* Multi-file menu */
                    <>
                        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent text-gray-900 dark:text-white">
                            {files.length} items selected
                        </div>
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onCopy}
                        >
                            Copy to...
                        </button>
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onMove}
                        >
                            Move to...
                        </button>
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-all font-medium"
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
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        onClick={onNewFolder}
                    >
                        New Folder
                    </button>
                    {hasFiles && (
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
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
