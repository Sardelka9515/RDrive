import { useNavigate } from 'react-router-dom';
import { parseBreadcrumbs, buildPath } from './utils';

interface BreadcrumbsProps {
    remoteName: string;
    currentPath: string;
    dropTarget: string | null;
    onDragOver: (key: string) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, path: string) => void;
    draggedFiles: any[];
}

export function Breadcrumbs({
    remoteName,
    currentPath,
    dropTarget,
    onDragOver,
    onDragLeave,
    onDrop,
    draggedFiles,
}: BreadcrumbsProps) {
    const navigate = useNavigate();
    const breadcrumbs = parseBreadcrumbs(currentPath);

    return (
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2 flex-wrap gap-1">
            <span
                className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-all px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium ${dropTarget === '__root__' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                onClick={() => navigate(`/remotes/${remoteName}`)}
                onDragOver={e => {
                    if (draggedFiles.length === 0 || currentPath === '') return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    onDragOver('__root__');
                }}
                onDragLeave={() => onDragLeave()}
                onDrop={e => onDrop(e, '')}
            >
                Home
            </span>
            {breadcrumbs.map((part, index) => {
                const linkPath = buildPath(breadcrumbs.slice(0, index + 1));
                const bcKey = `__bc_${index}`;
                const isDropHere = dropTarget === bcKey;
                return (
                    <span key={index} className="flex items-center">
                        <span className="mx-1 text-gray-300 dark:text-gray-600">/</span>
                        <span
                            className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[150px] transition-all px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium ${isDropHere ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                            onClick={() => navigate(`/remotes/${remoteName}/${linkPath}`)}
                            onDragOver={e => {
                                if (draggedFiles.length === 0 || linkPath === currentPath) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                onDragOver(bcKey);
                            }}
                            onDragLeave={() => onDragLeave()}
                            onDrop={e => onDrop(e, linkPath)}
                        >
                            {part}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}
