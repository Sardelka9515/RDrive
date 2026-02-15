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
                <div className="flex items-center gap-3 mr-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
                    <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 shadow-sm"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300 w-10 text-right">
                        {Math.round(uploadProgress)}%
                    </span>
                </div>
            )}

            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 shadow-sm">
                <button
                    onClick={() => onSortToggle('name')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${sortBy === 'name' ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    Name
                </button>
                <button
                    onClick={() => onSortToggle('size')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${sortBy === 'size' ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    Size
                </button>
                <button
                    onClick={() => onSortToggle('time')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${sortBy === 'time' ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                    Time
                </button>
                <div className="w-px bg-gray-200 dark:border-gray-700 mx-1"></div>
                <button
                    onClick={onSortOrderToggle}
                    className="px-2.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md font-bold text-lg"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2 hidden md:block"></div>

            <button
                onClick={onViewModeToggle}
                className="btn-secondary text-sm flex items-center gap-2"
            >
                {viewMode === 'grid' ? (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                        <span>List</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                        <span>Grid</span>
                    </>
                )}
            </button>

            <button
                onClick={onUploadClick}
                disabled={uploading}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
        </div>
    );
}
