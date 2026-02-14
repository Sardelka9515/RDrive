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
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
            <span
                className={`cursor-pointer hover:text-blue-600 transition ${dropTarget === '__root__' ? 'text-blue-600 font-semibold underline' : ''}`}
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
                        <span className="mx-2">/</span>
                        <span
                            className={`cursor-pointer hover:text-blue-600 truncate max-w-[150px] transition ${isDropHere ? 'text-blue-600 font-semibold underline' : ''}`}
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
