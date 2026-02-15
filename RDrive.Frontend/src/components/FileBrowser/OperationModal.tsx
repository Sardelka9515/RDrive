import { useState } from 'react';
import type { FileItem } from '../../api';

interface OperationModalProps {
    type: 'copy' | 'move' | 'sync';
    files: FileItem[];
    remotes: string[];
    currentRemote: string;
    currentPath: string;
    onSubmit: (type: 'copy' | 'move' | 'sync', files: FileItem[], dstRemote: string, dstPath: string) => Promise<void>;
    onClose: () => void;
}

export function OperationModal({
    type,
    files,
    remotes,
    currentRemote,
    currentPath,
    onSubmit,
    onClose,
}: OperationModalProps) {
    const [dstRemote, setDstRemote] = useState(currentRemote);
    const [dstPath, setDstPath] = useState(
        files.length === 1
            ? (currentPath ? `${currentPath}/${files[0].Name}` : files[0].Name)
            : currentPath
    );
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await onSubmit(type, files, dstRemote, dstPath);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                        {type}{' '}
                        {files.length === 1
                            ? `"${files[0].Name}"`
                            : `${files.length} items`}
                    </h3>
                </div>

                <div className="p-6 space-y-4">

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destination Remote</label>
                    <select
                        className="input-field"
                        value={dstRemote}
                        onChange={e => setDstRemote(e.target.value)}
                    >
                        <option value="">Select Remote...</option>
                        {remotes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {files.length === 1 ? 'Destination Path' : 'Destination Folder'}
                    </label>
                    <input
                        type="text"
                        className="input-field"
                        value={dstPath}
                        onChange={e => setDstPath(e.target.value)}
                        placeholder={files.length === 1 ? 'folder/filename.ext' : 'folder/subfolder'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {files.length === 1
                            ? 'Enter full path including filename/foldername'
                            : 'Files will be placed inside this folder'}
                    </p>
                </div>

                {files.length > 1 && (
                    <div className="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        {files.map(f => (
                            <div key={f.Name} className="flex items-center gap-2 py-1">
                                {f.IsDir ? (
                                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                        </svg>
                                    </div>
                                ) : (
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                )}
                                <span className="truncate font-medium">{f.Name}</span>
                            </div>
                        ))}
                    </div>
                )}
                </div>

                <div className="p-6 pt-0 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="btn-secondary text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !dstRemote}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : type === 'copy' ? 'Copy' : type === 'move' ? 'Move' : 'Sync'}
                    </button>
                </div>
            </div>
        </div>
    );
}
