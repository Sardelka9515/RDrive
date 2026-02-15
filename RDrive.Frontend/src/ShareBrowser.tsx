import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type FileItem, type PublicShareInfo } from './api';

function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return '';
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Phase = 'loading' | 'password' | 'browse' | 'error';

export default function ShareBrowser() {
    const { shareId, '*': subPath } = useParams<{ shareId: string; '*': string }>();
    const navigate = useNavigate();
    const currentPath = subPath || '';

    const [phase, setPhase] = useState<Phase>('loading');
    const [info, setInfo] = useState<PublicShareInfo | null>(null);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState<string | undefined>();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [filesLoading, setFilesLoading] = useState(false);

    // Load share info
    useEffect(() => {
        if (!shareId) return;
        api.getPublicShareInfo(shareId)
            .then(data => {
                setInfo(data);
                if (data.hasPassword) {
                    // Check if we have a cached token
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

    // Load files when browsing
    useEffect(() => {
        if (phase !== 'browse' || !shareId) return;
        setFilesLoading(true);
        api.listShareFiles(shareId, currentPath, token)
            .then(setFiles)
            .catch(err => setError(err.message))
            .finally(() => setFilesLoading(false));
    }, [phase, shareId, currentPath, token]);

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

    function navigateTo(file: FileItem) {
        if (!file.IsDir) return;
        const newPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
        navigate(`/s/${shareId}/${newPath}`);
    }

    function handleDownload(file: FileItem) {
        if (!shareId) return;
        const filePath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
        api.downloadShareFile(shareId, filePath, file.Name, token);
    }

    function navigateUp() {
        const segments = currentPath.split('/').filter(Boolean);
        segments.pop();
        navigate(`/s/${shareId}/${segments.join('/')}`);
    }

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    // Error screen
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

    // Loading screen
    if (phase === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Loading share...</div>
            </div>
        );
    }

    // Password screen
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

    // Browse screen
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-gray-900 dark:text-white">{info?.name || 'Shared Files'}</h1>
                        {info?.description && <p className="text-xs text-gray-500 dark:text-gray-400">{info.description}</p>}
                    </div>
                </div>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">RDrive</span>
            </header>

            <div className="max-w-5xl mx-auto p-6">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
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

                {/* File list */}
                {filesLoading ? (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading files...</div>
                ) : files.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[200px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-400 dark:text-gray-500">This folder is empty</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                            <span>Name</span>
                            <span className="w-24 text-right">Size</span>
                            <span className="w-40 text-right hidden sm:block">Modified</span>
                            <span className="w-10"></span>
                        </div>
                        {/* Back row */}
                        {currentPath && (
                            <button
                                onClick={navigateUp}
                                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 w-full px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition text-left border-b border-gray-100 dark:border-gray-700/50"
                            >
                                <span className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                                    ..
                                </span>
                                <span className="w-24"></span>
                                <span className="w-40 hidden sm:block"></span>
                                <span className="w-10"></span>
                            </button>
                        )}
                        {/* File rows */}
                        {files.map(file => (
                            <div
                                key={file.Name}
                                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition border-b last:border-b-0 border-gray-100 dark:border-gray-700/50 group"
                            >
                                <button
                                    onClick={() => file.IsDir ? navigateTo(file) : handleDownload(file)}
                                    className="flex items-center gap-3 text-left min-w-0"
                                >
                                    {file.IsDir ? (
                                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                                    )}
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{file.Name}</span>
                                </button>
                                <span className="w-24 text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                                    {file.IsDir ? '—' : formatSize(file.Size)}
                                </span>
                                <span className="w-40 text-right text-sm text-gray-500 dark:text-gray-400 self-center hidden sm:block">
                                    {formatDate(file.ModTime)}
                                </span>
                                <span className="w-10 flex items-center justify-center">
                                    {!file.IsDir && (
                                        <button
                                            onClick={() => handleDownload(file)}
                                            className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition"
                                            title="Download"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Share info footer */}
                {info?.expiration && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
                        This share expires on {new Date(info.expiration).toLocaleDateString()}
                    </p>
                )}
            </div>
        </div>
    );
}
