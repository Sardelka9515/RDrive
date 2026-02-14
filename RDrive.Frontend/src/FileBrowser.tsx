import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type FileItem } from './api';
import { useToast } from './Toast';
import { Breadcrumbs } from './components/FileBrowser/Breadcrumbs';
import { Toolbar } from './components/FileBrowser/Toolbar';
import { FileGrid } from './components/FileBrowser/FileGrid';
import { ContextMenu } from './components/FileBrowser/ContextMenu';
import { OperationModal } from './components/FileBrowser/OperationModal';
import { SelectionBar } from './components/FileBrowser/SelectionBar';
import { useFileSelection } from './components/FileBrowser/useFileSelection';
import { useFileSorting } from './components/FileBrowser/useFileSorting';
import { useFileOperations } from './components/FileBrowser/useFileOperations';
import { useDragAndDrop } from './components/FileBrowser/useDragAndDrop';

export default function FileBrowser() {
    const { remoteName, '*': path } = useParams<{ remoteName: string; '*': string }>();
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const currentPath = path || '';

    // State
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; files: FileItem[] } | null>(null);
    const [modal, setModal] = useState<{ type: 'copy' | 'move' | 'sync'; files: FileItem[] } | null>(null);
    const [remotes, setRemotes] = useState<string[]>([]);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Custom hooks
    const { sortedFiles, sortBy, sortOrder, toggleSort, setSortOrder } = useFileSorting(files);
    const {
        selectedNames,
        getSelectedItems,
        handleFileClick,
        selectAll,
        clearSelection,
        selectSingle,
    } = useFileSelection(files);
    const {
        uploading,
        uploadProgress,
        handleUpload,
        handleNewFolder,
        handleRename,
        handleDelete,
        handleCopyMove,
        handleMove,
    } = useFileOperations({
        remoteName,
        currentPath,
        onSuccess: showSuccess,
        onError: showError,
        onReload: loadFiles,
    });
    const {
        draggedFiles,
        dropTarget,
        setDropTarget,
        handleDragStart,
        handleFolderDragOver,
        handleFolderDragLeave,
        handleDragEnd,
        clearDragState,
    } = useDragAndDrop(selectedNames, getSelectedItems, selectSingle);

    /* ── Data loading ─────────────────────────────────── */

    function loadFiles() {
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
    }

    function loadRemotes() {
        api.getRemotes().then(setRemotes).catch(err => showError(`Failed to load remotes: ${err.message}`));
    }

    useEffect(() => {
        clearSelection();
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
                clearSelection();
                setContextMenu(null);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                if (containerRef.current?.contains(document.activeElement || document.body)) {
                    e.preventDefault();
                    selectAll();
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [files, selectAll, clearSelection]);

    /* ── Event handlers ───────────────────────────────── */

    const handleFileClickWrapper = (e: React.MouseEvent, file: FileItem, index: number) => {
        setContextMenu(null);
        handleFileClick(e, file, index, sortedFiles);
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
            selectSingle(file.Name);
            targets = [file];
        }
        setContextMenu({ x: e.clientX, y: e.clientY, files: targets });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, files: [] });
    };

    /* ── Upload & File actions ───────────────────────────── */

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        await handleUpload(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    };

    const handleModalSubmit = async (
        type: 'copy' | 'move' | 'sync',
        files: FileItem[],
        dstRemote: string,
        dstPath: string,
    ) => {
        await handleCopyMove(type, files, dstRemote, dstPath);
    };

    /* ── Drag & Drop ──────────────────────────────────── */

    const handleFolderDrop = async (e: React.DragEvent, targetFolderPath: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        if (!remoteName || draggedFiles.length === 0) return;
        if (targetFolderPath === currentPath) return;
        await handleMove(draggedFiles, targetFolderPath);
        clearSelection();
        clearDragState();
    };

    /* ── Render ───────────────────────────────────────── */

    return (
        <div
            onClick={() => { clearSelection(); setContextMenu(null); }}
            onContextMenu={handleBackgroundContextMenu}
            ref={containerRef}
            className="min-h-screen pb-20"
            tabIndex={-1}
        >
            {/* Header */}
            <div
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white capitalize">
                        {remoteName}
                    </h2>
                    <Breadcrumbs
                        remoteName={remoteName || ''}
                        currentPath={currentPath}
                        dropTarget={dropTarget}
                        onDragOver={setDropTarget}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={handleFolderDrop}
                        draggedFiles={draggedFiles}
                    />
                </div>

                <Toolbar
                    uploading={uploading}
                    uploadProgress={uploadProgress}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    viewMode={viewMode}
                    onSortToggle={toggleSort}
                    onSortOrderToggle={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    onViewModeToggle={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
                    onUploadClick={handleUploadClick}
                />
            </div>

            {/* Files Area */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <FileGrid
                    files={sortedFiles}
                    viewMode={viewMode}
                    selectedNames={selectedNames}
                    draggedFiles={draggedFiles}
                    dropTarget={dropTarget}
                    currentPath={currentPath}
                    onFileClick={handleFileClickWrapper}
                    onFileDoubleClick={handleFileDoubleClick}
                    onContextMenu={handleContextMenu}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onFolderDragOver={handleFolderDragOver}
                    onFolderDragLeave={handleFolderDragLeave}
                    onFolderDrop={handleFolderDrop}
                />
            )}

            {/* Upload Input */}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

            {/* Selection Bar */}
            <SelectionBar
                count={selectedNames.size}
                onCopy={() => openModal('copy', true)}
                onMove={() => openModal('move', true)}
                onDelete={() => {
                    handleDelete(getSelectedItems());
                    clearSelection();
                }}
                onClear={clearSelection}
            />

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    files={contextMenu.files}
                    onClose={() => setContextMenu(null)}
                    onOpen={handleFileDoubleClick}
                    onRename={() => {
                        if (contextMenu.files[0]) handleRename(contextMenu.files[0]);
                        setContextMenu(null);
                    }}
                    onCopy={() => openModal('copy')}
                    onMove={() => openModal('move')}
                    onSync={() => openModal('sync')}
                    onDelete={() => {
                        handleDelete(contextMenu.files);
                        setContextMenu(null);
                    }}
                    onNewFolder={() => {
                        setContextMenu(null);
                        handleNewFolder();
                    }}
                    onSelectAll={() => {
                        setContextMenu(null);
                        selectAll();
                    }}
                    hasFiles={files.length > 0}
                />
            )}

            {/* Operation Modal */}
            {modal && (
                <OperationModal
                    type={modal.type}
                    files={modal.files}
                    remotes={remotes}
                    currentRemote={remoteName || ''}
                    currentPath={currentPath}
                    onSubmit={handleModalSubmit}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
