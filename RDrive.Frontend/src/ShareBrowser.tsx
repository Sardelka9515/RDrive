import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type FileItem, type PublicShareInfo } from './api';
import { useToast } from './Toast';
import { Toolbar } from './components/FileBrowser/Toolbar';
import { FileGrid } from './components/FileBrowser/FileGrid';
import { ContextMenu } from './components/FileBrowser/ContextMenu';
import { SelectionBar } from './components/FileBrowser/SelectionBar';
import { useFileSelection } from './components/FileBrowser/useFileSelection';
import { useFileSorting } from './components/FileBrowser/useFileSorting';
import { useShareFileOperations } from './components/FileBrowser/useShareFileOperations';

type Phase = 'loading' | 'password' | 'browse' | 'error';

const noop = () => {};

export default function ShareBrowser() {
    const { shareId, '*': subPath } = useParams<{ shareId: string; '*': string }>();
    const navigate = useNavigate();
    const { showError } = useToast();
    const currentPath = subPath || '';

    const [phase, setPhase] = useState<Phase>('loading');
    const [info, setInfo] = useState<PublicShareInfo | null>(null);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState<string | undefined>();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; files: FileItem[] } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const writeable = !!info?.writeable;

    const { sortedFiles, sortBy, sortOrder, toggleSort, setSortOrder } = useFileSorting(files);
    const {
        selectedNames,
        getSelectedItems,
        handleFileClick,
        selectAll,
        clearSelection,
        selectSingle,
    } = useFileSelection(files);

    const reload = () => setRefreshKey(k => k + 1);
    const { uploading, uploadProgress, handleUpload, handleNewFolder, handleRename, handleDelete } =
        useShareFileOperations({ shareId, token, currentPath, onError: showError, onReload: reload });

    /* ── Load share info ──────────────────────────────── */
    useEffect(() => {
        if (!shareId) return;
        api.getPublicShareInfo(shareId)
            .then(data => {
                setInfo(data);
                if (data.hasPassword) {
                    const cached = sessionStorage.getItem(`share-token-${shareId}`);
                    if (cached) {
                        setToken(cached);
                        setPhase('browse');
                    } else {
                        setPhase('password');
                    }
                } else {
                    setPhase('browse');
                }
            })
            .catch(err => {
                setError(err.message || 'Share not found or expired');
                setPhase('error');
            });
    }, [shareId]);

    /* ── Load files ───────────────────────────────────── */
    useEffect(() => {
        if (phase !== 'browse' || !shareId) return;
        clearSelection();
        setFilesLoading(true);
        api.listShareFiles(shareId, currentPath, token)
            .then(setFiles)
            .catch(err => showError(err.message))
            .finally(() => setFilesLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, shareId, currentPath, token, refreshKey]);

    // Close context menu on outside click
    useEffect(() => {
        const h = () => setContextMenu(null);
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    /* ── Auth ─────────────────────────────────────────── */
    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!shareId) return;
        try {
            const tok = await api.authenticateShare(shareId, password);
            setToken(tok);
            sessionStorage.setItem(`share-token-${shareId}`, tok);
            setPhase('browse');
        } catch {
            setError('Invalid password');
        }
    }

    /* ── Navigation & file actions ────────────────────── */
    function handleDownload(file: FileItem) {
        if (!shareId) return;
        const filePath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
        api.downloadShareFile(shareId, filePath, file.Name, token);
    }

    const handleFileClickWrapper = (e: React.MouseEvent, file: FileItem, index: number) => {
        setContextMenu(null);
        handleFileClick(e, file, index, sortedFiles);
    };

    const handleFileDoubleClick = (e: React.MouseEvent, file: FileItem) => {
        e.stopPropagation();
        if (file.IsDir) {
            const newPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
            navigate(`/s/${shareId}/${newPath}`);
        } else {
            handleDownload(file);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
        e.preventDefault();
        e.stopPropagation();
        if (!writeable) return;
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
        if (!writeable) return;
        setContextMenu({ x: e.clientX, y: e.clientY, files: [] });
    };

    const handleUploadClick = () => fileInputRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        await handleUpload(e.target.files[0]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    /* ── Error / loading / password screens ───────────── */
    if (phase === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M15 12a3 3 0 01-3 3m0 0l6.12 6.12" /></svg>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Share Unavailable</h1>
                    <p className="text-gray-500 dark:text-gray-400">{error || 'This share link is invalid, expired, or has been removed.'}</p>
                </div>
            </div>
        );
    }

    if (phase === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Loading share...</div>
            </div>
        );
    }

    if (phase === 'password') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-8">
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{info?.name || 'Shared Files'}</h1>
                        {info?.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{info.description}</p>}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">This share is password protected.</p>
                    </div>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            placeholder="Enter password"
                            autoFocus
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                            Access Share
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    /* ── Browse screen ────────────────────────────────── */
    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            onClick={() => { clearSelection(); setContextMenu(null); }}
            onContextMenu={handleBackgroundContextMenu}
        >
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            {info?.name || 'Shared Files'}
                            {writeable && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">Editable</span>
                            )}
                        </h1>
                        {info?.description && <p className="text-xs text-gray-500 dark:text-gray-400">{info.description}</p>}
                    </div>
                </div>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">RDrive</span>
            </header>

            <div className="max-w-5xl mx-auto p-6">
                {/* Breadcrumb + toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4" onClick={e => e.stopPropagation()}>
                    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                        <button
                            onClick={() => navigate(`/s/${shareId}`)}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition font-medium"
                        >
                            {info?.name || 'Root'}
                        </button>
                        {breadcrumbs.map((seg, i) => (
                            <span key={i} className="flex items-center gap-1">
                                <span className="text-gray-300 dark:text-gray-600">/</span>
                                <button
                                    onClick={() => navigate(`/s/${shareId}/${breadcrumbs.slice(0, i + 1).join('/')}`)}
                                    className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                                >
                                    {seg}
                                </button>
                            </span>
                        ))}
                    </nav>

                    <Toolbar
                        uploading={uploading}
                        uploadProgress={uploadProgress}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        viewMode={viewMode}
                        onSortToggle={toggleSort}
                        onSortOrderToggle={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        onViewModeToggle={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
                        onUploadClick={writeable ? handleUploadClick : undefined}
                    />
                </div>

                {/* Files */}
                <div onClick={e => e.stopPropagation()}>
                    {filesLoading ? (
                        <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading files...</div>
                    ) : (
                        <FileGrid
                            files={sortedFiles}
                            viewMode={viewMode}
                            selectedNames={selectedNames}
                            draggedFiles={[]}
                            dropTarget={null}
                            currentPath={currentPath}
                            onFileClick={handleFileClickWrapper}
                            onFileDoubleClick={handleFileDoubleClick}
                            onContextMenu={handleContextMenu}
                            onDragStart={noop}
                            onDragEnd={noop}
                            onFolderDragOver={noop}
                            onFolderDragLeave={noop}
                            onFolderDrop={noop}
                        />
                    )}
                </div>

                {/* Share info footer */}
                {info?.expiration && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
                        This share expires on {new Date(info.expiration).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Upload input */}
            {writeable && <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />}

            {/* Selection bar (delete only) */}
            {writeable && (
                <SelectionBar
                    count={selectedNames.size}
                    onDelete={() => { handleDelete(getSelectedItems()); clearSelection(); }}
                    onClear={clearSelection}
                />
            )}

            {/* Context menu */}
            {writeable && contextMenu && (
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
                    onDelete={() => {
                        handleDelete(contextMenu.files);
                        setContextMenu(null);
                    }}
                    onNewFolder={() => { setContextMenu(null); handleNewFolder(); }}
                    onSelectAll={() => { setContextMenu(null); selectAll(); }}
                    hasFiles={files.length > 0}
                    currentFolderName={breadcrumbs[breadcrumbs.length - 1] || info?.name || ''}
                />
            )}
        </div>
    );
}
