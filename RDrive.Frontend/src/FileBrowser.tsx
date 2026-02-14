import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type FileItem } from './api';
import { useToast } from './Toast';

export default function FileBrowser() {
    const { remoteName, '*': path } = useParams<{ remoteName: string; '*': string }>();
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const currentPath = path || '';

    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'time'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Multi-select
    const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
    const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);

    // Context menu & modal
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; files: FileItem[] } | null>(null);
    const [modal, setModal] = useState<{ type: 'copy' | 'move' | 'sync'; files: FileItem[] } | null>(null);

    // Drag & drop
    const [draggedFiles, setDraggedFiles] = useState<FileItem[]>([]);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // Modal fields
    const [remotes, setRemotes] = useState<string[]>([]);
    const [dstRemote, setDstRemote] = useState('');
    const [dstPath, setDstPath] = useState('');
    const [opLoading, setOpLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    /* ── Data loading ─────────────────────────────────── */

    const loadFiles = () => {
        if (!remoteName) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setLoading(true);
        setFiles([]);
        api.listFiles(remoteName, currentPath, controller.signal)
            .then(f => { if (!controller.signal.aborted) setFiles(f); })
            .catch(err => { if (err.name !== 'AbortError') showError(`Failed to load files: ${err.message}`); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    };

    const loadRemotes = () => {
        api.getRemotes().then(setRemotes).catch(err => showError(`Failed to load remotes: ${err.message}`));
    };

    useEffect(() => {
        setSelectedNames(new Set());
        setLastClickedIdx(null);
        loadFiles();
        loadRemotes();
    }, [remoteName, currentPath]);

    // Close context menu on outside click
    useEffect(() => {
        const h = () => setContextMenu(null);
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedNames(new Set());
                setContextMenu(null);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                if (containerRef.current?.contains(document.activeElement || document.body)) {
                    e.preventDefault();
                    setSelectedNames(new Set(files.map(f => f.Name)));
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [files]);

    /* ── Sorting ──────────────────────────────────────── */

    const sortedFiles = [...files].sort((a, b) => {
        if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
        let cmp = 0;
        switch (sortBy) {
            case 'name': cmp = a.Name.localeCompare(b.Name); break;
            case 'size': cmp = a.Size - b.Size; break;
            case 'time': cmp = new Date(a.ModTime).getTime() - new Date(b.ModTime).getTime(); break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
    });

    const toggleSort = (field: 'name' | 'size' | 'time') => {
        if (sortBy === field) setSortOrder(p => (p === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(field); setSortOrder('asc'); }
    };

    /* ── Helpers ──────────────────────────────────────── */

    const getSelectedItems = useCallback(
        () => files.filter(f => selectedNames.has(f.Name)),
        [files, selectedNames],
    );

    /* ── Selection handlers ───────────────────────────── */

    const handleFileClick = (e: React.MouseEvent, file: FileItem, index: number) => {
        e.stopPropagation();
        setContextMenu(null);
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
    };

    const handleFileDoubleClick = (e: React.MouseEvent, file: FileItem) => {
        e.stopPropagation();
        const targetPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
        if (file.IsDir) navigate(`/remotes/${remoteName}/${targetPath}`);
        else window.open(`/api/remotes/${remoteName}/files/${targetPath}`, '_blank');
    };

    /* ── Context menu ─────────────────────────────────── */

    const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
        e.preventDefault();
        e.stopPropagation();
        let targets: FileItem[];
        if (selectedNames.has(file.Name) && selectedNames.size > 1) {
            targets = getSelectedItems();
        } else {
            setSelectedNames(new Set([file.Name]));
            targets = [file];
        }
        setContextMenu({ x: e.clientX, y: e.clientY, files: targets });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, files: [] });
    };

    /* ── File actions ─────────────────────────────────── */

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !remoteName) return;
        const file = e.target.files[0];
        setUploading(true);
        setUploadProgress(0);
        try {
            await api.uploadFile(remoteName, currentPath, file, p => setUploadProgress(p));
            loadFiles();
        } catch (error: any) {
            showError(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleNewFolder = async () => {
        if (!remoteName) return;
        setContextMenu(null);
        const name = prompt('Enter folder name:');
        if (!name) return;
        const target = currentPath ? `${currentPath}/${name}` : name;
        try {
            await api.createDirectory(remoteName, target);
            loadFiles();
        } catch (error: any) {
            showError(`Failed to create folder: ${error.message}`);
        }
    };

    const handleRename = async () => {
        if (!contextMenu?.files.length || contextMenu.files.length !== 1 || !remoteName) return;
        const file = contextMenu.files[0];
        setContextMenu(null);
        const newName = prompt('Enter new name:', file.Name);
        if (!newName || newName === file.Name) return;
        const srcP = currentPath ? `${currentPath}/${file.Name}` : file.Name;
        const dstP = currentPath ? `${currentPath}/${newName}` : newName;
        try {
            await api.renameFile(remoteName, srcP, dstP);
            loadFiles();
        } catch (error: any) {
            showError(`Rename failed: ${error.message}`);
        }
    };

    const handleBulkDelete = async (items?: FileItem[]) => {
        if (!remoteName) return;
        const toDelete = items ?? contextMenu?.files ?? getSelectedItems();
        setContextMenu(null);
        if (toDelete.length === 0) return;
        const msg = toDelete.length === 1
            ? `Are you sure you want to delete ${toDelete[0].Name}?`
            : `Are you sure you want to delete ${toDelete.length} items?`;
        if (!confirm(msg)) return;
        try {
            await Promise.all(toDelete.map(f => {
                const tp = currentPath ? `${currentPath}/${f.Name}` : f.Name;
                return api.deleteFile(remoteName, tp);
            }));
            setSelectedNames(new Set());
            loadFiles();
        } catch (error: any) {
            showError(`Delete failed: ${error.message}`);
            loadFiles();
        }
    };

    const openModal = (type: 'copy' | 'move' | 'sync', fromBar = false) => {
        let targetFiles: FileItem[];
        if (fromBar) {
            targetFiles = getSelectedItems();
        } else {
            if (!contextMenu?.files.length) return;
            targetFiles = contextMenu.files;
        }
        setContextMenu(null);
        if (!targetFiles.length) return;
        setModal({ type, files: targetFiles });
        setDstRemote(remoteName || '');
        setDstPath(
            targetFiles.length === 1
                ? (currentPath ? `${currentPath}/${targetFiles[0].Name}` : targetFiles[0].Name)
                : currentPath,
        );
    };

    const submitOperation = async () => {
        if (!modal || !remoteName) return;
        setOpLoading(true);
        try {
            for (const file of modal.files) {
                const srcP = currentPath ? `${currentPath}/${file.Name}` : file.Name;
                const fileDst = modal.files.length === 1
                    ? dstPath
                    : dstPath ? `${dstPath}/${file.Name}` : file.Name;
                if (modal.type === 'copy') await api.copyFile(remoteName, srcP, dstRemote, fileDst, file.IsDir);
                else if (modal.type === 'move') await api.moveFile(remoteName, srcP, dstRemote, fileDst, file.IsDir);
                else if (modal.type === 'sync') await api.startSync(remoteName, srcP, dstRemote, fileDst);
            }
            setModal(null);
            const n = modal.files.length;
            const op = modal.type.charAt(0).toUpperCase() + modal.type.slice(1);
            showSuccess(`${op} job${n > 1 ? 's' : ''} started. Check the Jobs page for progress.`);
            if (modal.type === 'move') loadFiles();
        } catch (error: any) {
            showError(`Operation failed: ${error.message}`);
        } finally {
            setOpLoading(false);
        }
    };

    /* ── Drag & Drop ──────────────────────────────────── */

    const handleDragStart = (e: React.DragEvent, file: FileItem) => {
        let items: FileItem[];
        if (selectedNames.has(file.Name)) {
            items = getSelectedItems();
        } else {
            setSelectedNames(new Set([file.Name]));
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
    };

    const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
        if (draggedFiles.length === 0) return;
        if (draggedFiles.some(f => f.Name === folderName)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(folderName);
    };

    const handleFolderDragLeave = (e: React.DragEvent) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (!e.currentTarget.contains(related)) setDropTarget(null);
    };

    const handleFolderDrop = async (e: React.DragEvent, targetFolderPath: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        if (!remoteName || draggedFiles.length === 0) return;
        if (targetFolderPath === currentPath) return; // already here
        try {
            for (const file of draggedFiles) {
                const srcPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
                const dst = targetFolderPath ? `${targetFolderPath}/${file.Name}` : file.Name;
                if (srcPath === dst) continue;
                await api.renameFile(remoteName, srcPath, dst);
            }
            setSelectedNames(new Set());
            loadFiles();
        } catch (error: any) {
            showError(`Move failed: ${error.message}`);
            loadFiles();
        }
        setDraggedFiles([]);
    };

    const handleDragEnd = () => {
        setDraggedFiles([]);
        setDropTarget(null);
    };

    /* ── Breadcrumbs ──────────────────────────────────── */

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    /* ── Render ───────────────────────────────────────── */

    return (
        <div
            onClick={() => { setSelectedNames(new Set()); setContextMenu(null); }}
            onContextMenu={handleBackgroundContextMenu}
            ref={containerRef}
            className="min-h-screen pb-20"
            tabIndex={-1}
        >
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6" onClick={e => e.stopPropagation()}>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white capitalize">{remoteName}</h2>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                        <span
                            className={`cursor-pointer hover:text-blue-600 transition ${dropTarget === '__root__' ? 'text-blue-600 font-semibold underline' : ''}`}
                            onClick={() => navigate(`/remotes/${remoteName}`)}
                            onDragOver={e => {
                                if (draggedFiles.length === 0 || currentPath === '') return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                setDropTarget('__root__');
                            }}
                            onDragLeave={() => setDropTarget(prev => (prev === '__root__' ? null : prev))}
                            onDrop={e => handleFolderDrop(e, '')}
                        >
                            Home
                        </span>
                        {breadcrumbs.map((part, index) => {
                            const linkPath = breadcrumbs.slice(0, index + 1).join('/');
                            const bcKey = `__bc_${index}`;
                            const isDropHere = dropTarget === bcKey;
                            return (
                                <span key={index} className="flex items-center">
                                    <span className="mx-2">/</span>
                                    <span
                                        className={`cursor-pointer hover:text-blue-600 truncate max-w-[150px] transition ${isDropHere ? 'text-blue-600 font-semibold underline' : ''}`}
                                        onClick={() => navigate(`/remotes/${remoteName}/${linkPath}`)}
                                        onDragOver={e => {
                                            if (draggedFiles.length === 0 || linkPath === currentPath) return;
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            setDropTarget(bcKey);
                                        }}
                                        onDragLeave={() => setDropTarget(prev => (prev === bcKey ? null : prev))}
                                        onDrop={e => handleFolderDrop(e, linkPath)}
                                    >
                                        {part}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                    {uploading && (
                        <div className="flex items-center gap-2 mr-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <span className="text-xs font-medium text-blue-700 w-8 text-right">{Math.round(uploadProgress)}%</span>
                        </div>
                    )}

                    <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                        <button onClick={() => toggleSort('name')} className={`px-3 py-1 text-sm rounded ${sortBy === 'name' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>Name</button>
                        <button onClick={() => toggleSort('size')} className={`px-3 py-1 text-sm rounded ${sortBy === 'size' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>Size</button>
                        <button onClick={() => toggleSort('time')} className={`px-3 py-1 text-sm rounded ${sortBy === 'time' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>Time</button>
                        <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                        <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="px-2 text-gray-500 hover:text-blue-600">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2 hidden md:block"></div>

                    <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 bg-white dark:bg-gray-800 border rounded shadow-sm hover:bg-gray-50">
                        {viewMode === 'grid' ? 'List View' : 'Grid View'}
                    </button>

                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    <button onClick={handleUploadClick} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50">
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>

            {/* Files Area */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : sortedFiles.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200">
                    <p className="text-gray-400">Folder is empty</p>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
                    {sortedFiles.map((file, index) => {
                        const isSelected = selectedNames.has(file.Name);
                        const isDragging = draggedFiles.some(f => f.Name === file.Name);
                        const isDropHere = file.IsDir && dropTarget === file.Name;
                        return (
                            <div
                                key={file.Name}
                                draggable
                                onClick={e => handleFileClick(e, file, index)}
                                onDoubleClick={e => handleFileDoubleClick(e, file)}
                                onContextMenu={e => handleContextMenu(e, file)}
                                onDragStart={e => handleDragStart(e, file)}
                                onDragEnd={handleDragEnd}
                                onDragOver={file.IsDir ? (e => handleFolderDragOver(e, file.Name)) : undefined}
                                onDragLeave={file.IsDir ? handleFolderDragLeave : undefined}
                                onDrop={file.IsDir ? (e => handleFolderDrop(e, currentPath ? `${currentPath}/${file.Name}` : file.Name)) : undefined}
                                className={`
                                    group cursor-pointer rounded-lg border p-4 transition-all select-none
                                    ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md ring-1 ring-blue-500'
                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow hover:border-blue-300'}
                                    ${isDragging ? 'opacity-40' : ''}
                                    ${isDropHere ? 'ring-2 ring-blue-400 border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : ''}
                                    ${viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col items-center text-center'}
                                `}
                            >
                                <div className={`flex ${viewMode === 'list' ? 'items-center gap-4 flex-grow' : 'flex-col items-center gap-2'} min-w-0 w-full`}>
                                    <div className="text-4xl text-blue-500 flex-shrink-0">
                                        {file.IsDir ? (
                                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                                        ) : (
                                            <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
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
                    })}
                </div>
            )}

            {/* ── Selection Bar (floating bottom) ──────────── */}
            {selectedNames.size > 1 && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3"
                    onClick={e => e.stopPropagation()}
                >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">
                        {selectedNames.size} items selected
                    </span>
                    <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
                    <button
                        onClick={() => openModal('copy', true)}
                        className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                    >
                        Copy
                    </button>
                    <button
                        onClick={() => openModal('move', true)}
                        className="px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition"
                    >
                        Move
                    </button>
                    <button
                        onClick={() => handleBulkDelete(getSelectedItems())}
                        className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => setSelectedNames(new Set())}
                        className="ml-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                        title="Clear selection"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            {/* ── Context Menu ─────────────────────────────── */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 w-48 text-sm text-gray-700 dark:text-gray-200"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    {contextMenu.files.length > 0 ? (
                        contextMenu.files.length === 1 ? (
                            /* ── Single-file menu ── */
                            <>
                                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-700 truncate">
                                    {contextMenu.files[0].Name}
                                </div>
                                {contextMenu.files[0].IsDir ? (
                                    <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => handleFileDoubleClick({ stopPropagation: () => {} } as any, contextMenu.files[0])}>Open</button>
                                ) : (
                                    <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => handleFileDoubleClick({ stopPropagation: () => {} } as any, contextMenu.files[0])}>Download</button>
                                )}
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={handleRename}>Rename</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => openModal('copy')}>Copy to...</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => openModal('move')}>Move to...</button>
                                {contextMenu.files[0].IsDir && (
                                    <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => openModal('sync')}>Sync to...</button>
                                )}
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={() => handleBulkDelete()}>Delete</button>
                            </>
                        ) : (
                            /* ── Multi-file menu ── */
                            <>
                                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-700">
                                    {contextMenu.files.length} items selected
                                </div>
                                <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => openModal('copy')}>Copy to...</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => openModal('move')}>Move to...</button>
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={() => handleBulkDelete()}>Delete</button>
                            </>
                        )
                    ) : (
                        /* ── Background menu ── */
                        <>
                            <button className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700" onClick={handleNewFolder}>New Folder</button>
                            {files.length > 0 && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                                    onClick={() => { setContextMenu(null); setSelectedNames(new Set(files.map(f => f.Name))); }}
                                >
                                    Select All
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── Operation Modal ──────────────────────────── */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModal(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 capitalize">
                            {modal.type}{' '}
                            {modal.files.length === 1
                                ? `"${modal.files[0].Name}"`
                                : `${modal.files.length} items`}
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Destination Remote</label>
                            <select
                                className="w-full border rounded p-2 dark:bg-gray-700"
                                value={dstRemote}
                                onChange={e => setDstRemote(e.target.value)}
                            >
                                <option value="">Select Remote...</option>
                                {remotes.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">
                                {modal.files.length === 1 ? 'Destination Path' : 'Destination Folder'}
                            </label>
                            <input
                                type="text"
                                className="w-full border rounded p-2 dark:bg-gray-700"
                                value={dstPath}
                                onChange={e => setDstPath(e.target.value)}
                                placeholder={modal.files.length === 1 ? 'folder/filename.ext' : 'folder/subfolder'}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {modal.files.length === 1
                                    ? 'Enter full path including filename/foldername'
                                    : 'Files will be placed inside this folder'}
                            </p>
                        </div>

                        {modal.files.length > 1 && (
                            <div className="mb-4 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                                {modal.files.map(f => (
                                    <div key={f.Name} className="flex items-center gap-2 py-0.5">
                                        {f.IsDir ? (
                                            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                        ) : (
                                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                                        )}
                                        <span className="truncate">{f.Name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button
                                onClick={submitOperation}
                                disabled={opLoading || !dstRemote}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {opLoading ? 'Processing...' : modal.type === 'copy' ? 'Copy' : modal.type === 'move' ? 'Move' : 'Sync'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string) {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return '-';
    return new Date(dateStr).toLocaleString();
}
