import { useEffect, useRef, useState } from 'react';
import { api, type FileItem } from '../../api';
import { getMediaKind, joinPath, formatSize } from './utils';

interface MediaViewerProps {
    remoteName: string;
    currentPath: string;
    /** Media files (images/videos) in the current folder, in display order. */
    items: FileItem[];
    /** Index into `items` of the file to show first. */
    startIndex: number;
    onClose: () => void;
    onDownload: (file: FileItem) => void;
}

export function MediaViewer({
    remoteName,
    currentPath,
    items,
    startIndex,
    onClose,
    onDownload,
}: MediaViewerProps) {
    const [index, setIndex] = useState(startIndex);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const file = items[index];
    const kind = file ? getMediaKind(file) : null;
    const hasPrev = index > 0;
    const hasNext = index < items.length - 1;

    const goPrev = () => { if (hasPrev) setIndex(i => i - 1); };
    const goNext = () => { if (hasNext) setIndex(i => i + 1); };

    // Mint a scoped media token, then point the media element at a direct stream URL.
    // The browser streams (and seeks, for video) natively — nothing is buffered into memory.
    useEffect(() => {
        if (!file) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const load = async () => {
            setLoading(true);
            setError(null);
            setUrl(null);
            const filePath = joinPath(currentPath, file.Name);
            try {
                const token = await api.getMediaToken(remoteName, filePath, controller.signal);
                if (controller.signal.aborted) return;
                setUrl(api.buildStreamUrl(remoteName, filePath, token));
            } catch (err) {
                const e = err as { name?: string; message?: string };
                if (e.name !== 'AbortError') setError(e.message || 'Failed to load file');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        load();

        return () => controller.abort();
    }, [remoteName, currentPath, file]);

    // Keyboard navigation.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [hasPrev, hasNext]);

    if (!file) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Top bar */}
            <div
                className="flex items-center justify-between gap-4 px-4 py-3 text-white bg-gradient-to-b from-black/60 to-transparent"
                onClick={e => e.stopPropagation()}
            >
                <div className="min-w-0">
                    <p className="font-semibold truncate" title={file.Name}>{file.Name}</p>
                    <p className="text-xs text-gray-300">
                        {index + 1} / {items.length}{file.Size ? ` · ${formatSize(file.Size)}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => onDownload(file)}
                        className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                        title="Download"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                        title="Close (Esc)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Stage */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4" onClick={onClose}>
                {/* Prev */}
                {hasPrev && (
                    <button
                        onClick={e => { e.stopPropagation(); goPrev(); }}
                        className="absolute left-2 md:left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                        title="Previous (←)"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                )}

                <div className="max-w-full max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    {loading && (
                        <div className="relative">
                            <div className="animate-spin rounded-full h-14 w-14 border-4 border-gray-600"></div>
                            <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500 border-t-transparent absolute top-0 left-0"></div>
                        </div>
                    )}
                    {error && !loading && (
                        <div className="text-center text-gray-200">
                            <p className="text-lg font-semibold mb-1">Couldn't load this file</p>
                            <p className="text-sm text-gray-400">{error}</p>
                        </div>
                    )}
                    {url && !loading && !error && kind === 'image' && (
                        <img
                            src={url}
                            alt={file.Name}
                            className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg shadow-2xl"
                        />
                    )}
                    {url && !loading && !error && kind === 'video' && (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="max-w-[92vw] max-h-[82vh] rounded-lg shadow-2xl bg-black"
                        />
                    )}
                </div>

                {/* Next */}
                {hasNext && (
                    <button
                        onClick={e => { e.stopPropagation(); goNext(); }}
                        className="absolute right-2 md:right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                        title="Next (→)"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
}
