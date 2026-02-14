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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold mb-4 capitalize">
                    {type}{' '}
                    {files.length === 1
                        ? `"${files[0].Name}"`
                        : `${files.length} items`}
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
                        {files.length === 1 ? 'Destination Path' : 'Destination Folder'}
                    </label>
                    <input
                        type="text"
                        className="w-full border rounded p-2 dark:bg-gray-700"
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
                    <div className="mb-4 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                        {files.map(f => (
                            <div key={f.Name} className="flex items-center gap-2 py-0.5">
                                {f.IsDir ? (
                                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                )}
                                <span className="truncate">{f.Name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !dstRemote}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : type === 'copy' ? 'Copy' : type === 'move' ? 'Move' : 'Sync'}
                    </button>
                </div>
            </div>
        </div>
    );
}
