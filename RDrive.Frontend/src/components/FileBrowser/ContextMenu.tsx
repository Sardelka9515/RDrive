import { useLayoutEffect, useRef, useState } from 'react';
import type { FileItem as FileItemType } from '../../api';

interface ContextMenuProps {
    x: number;
    y: number;
    files: FileItemType[];
    onClose: () => void;
    onOpen: (e: React.MouseEvent, file: FileItemType) => void;
    onRename: () => void;
    onCopy?: () => void; // Optional actions hide when not provided (e.g. public share contexts)
    onMove?: () => void;
    onSync?: () => void;
    onShare?: () => void;
    onDelete: () => void;
    onNewFolder: () => void;
    onSelectAll: () => void;
    hasFiles: boolean;
    currentFolderName: string;
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
    onShare,
    onDelete,
    onNewFolder,
    onSelectAll,
    hasFiles,
    currentFolderName,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: y, left: x });

    // Clamp the menu within the viewport so it never opens off-screen.
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const margin = 8;
        const left = Math.max(margin, Math.min(x, window.innerWidth - width - margin));
        const top = Math.max(margin, Math.min(y, window.innerHeight - height - margin));
        setPos({ top, left });
    }, [x, y, files.length]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 w-56 text-sm text-gray-700 dark:text-gray-200 animate-fade-in"
            style={{ top: pos.top, left: pos.left }}
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
                        {onCopy && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onCopy}
                            >
                                Copy to...
                            </button>
                        )}
                        {onMove && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onMove}
                            >
                                Move to...
                            </button>
                        )}
                        {files[0].IsDir && onSync && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onSync}
                            >
                                Sync to...
                            </button>
                        )}
                        {onShare && (
                            <>
                                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                                <button
                                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2"
                                    onClick={onShare}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    Share...
                                </button>
                            </>
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
                        {onCopy && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onCopy}
                            >
                                Copy to...
                            </button>
                        )}
                        {onMove && (
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                onClick={onMove}
                            >
                                Move to...
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
                )
            ) : (
                /* Background menu — acts on the current folder itself */
                <>
                    <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent truncate text-gray-900 dark:text-white">
                        {currentFolderName || 'Current folder'}
                    </div>
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
                    {(onCopy || onMove || onSync) && <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />}
                    {onCopy && (
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onCopy}
                        >
                            Copy this folder to...
                        </button>
                    )}
                    {onMove && (
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onMove}
                        >
                            Move this folder to...
                        </button>
                    )}
                    {onSync && (
                        <button
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            onClick={onSync}
                        >
                            Sync this folder to...
                        </button>
                    )}
                    {onShare && (
                        <>
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                            <button
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2"
                                onClick={onShare}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                Share this folder...
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
