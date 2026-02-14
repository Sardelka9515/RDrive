interface ToolbarProps {
    uploading: boolean;
    uploadProgress: number;
    sortBy: 'name' | 'size' | 'time';
    sortOrder: 'asc' | 'desc';
    viewMode: 'grid' | 'list';
    onSortToggle: (field: 'name' | 'size' | 'time') => void;
    onSortOrderToggle: () => void;
    onViewModeToggle: () => void;
    onUploadClick: () => void;
}

export function Toolbar({
    uploading,
    uploadProgress,
    sortBy,
    sortOrder,
    viewMode,
    onSortToggle,
    onSortOrderToggle,
    onViewModeToggle,
    onUploadClick,
}: ToolbarProps) {
    return (
        <div className="flex gap-2 items-center flex-wrap">
            {uploading && (
                <div className="flex items-center gap-2 mr-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-blue-700 w-8 text-right">
                        {Math.round(uploadProgress)}%
                    </span>
                </div>
            )}

            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                <button
                    onClick={() => onSortToggle('name')}
                    className={`px-3 py-1 text-sm rounded ${sortBy === 'name' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    Name
                </button>
                <button
                    onClick={() => onSortToggle('size')}
                    className={`px-3 py-1 text-sm rounded ${sortBy === 'size' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    Size
                </button>
                <button
                    onClick={() => onSortToggle('time')}
                    className={`px-3 py-1 text-sm rounded ${sortBy === 'time' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    Time
                </button>
                <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button
                    onClick={onSortOrderToggle}
                    className="px-2 text-gray-500 hover:text-blue-600"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2 hidden md:block"></div>

            <button
                onClick={onViewModeToggle}
                className="p-2 bg-white dark:bg-gray-800 border rounded shadow-sm hover:bg-gray-50"
            >
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
            </button>

            <button
                onClick={onUploadClick}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
        </div>
    );
}
