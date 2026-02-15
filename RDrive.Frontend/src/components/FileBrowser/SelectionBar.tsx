interface SelectionBarProps {
    count: number;
    onCopy: () => void;
    onMove: () => void;
    onDelete: () => void;
    onClear: () => void;
}

export function SelectionBar({
    count,
    onCopy,
    onMove,
    onDelete,
    onClear,
}: SelectionBarProps) {
    if (count <= 1) return null;

    return (
        <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4 backdrop-blur-sm animate-slide-in"
            onClick={e => e.stopPropagation()}
        >
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {count} items selected
            </span>
            <div className="h-6 w-px bg-gray-300 dark:border-gray-600" />
            <button
                onClick={onCopy}
                className="px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all font-medium shadow-sm"
            >
                Copy
            </button>
            <button
                onClick={onMove}
                className="px-4 py-2 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-all font-medium shadow-sm"
            >
                Move
            </button>
            <button
                onClick={onDelete}
                className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-all font-medium shadow-sm"
            >
                Delete
            </button>
            <button
                onClick={onClear}
                className="ml-1 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                title="Clear selection"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
