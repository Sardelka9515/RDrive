import { useEffect, useState, useRef } from 'react';
import { api, type RTask } from './api';

const STATUS_COLORS: Record<string, string> = {
    Queued: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    Running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    Completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    Failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Stopped: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    Pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    Unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const TYPE_ICONS: Record<string, string> = {
    Copy: '📋',
    Move: '📦',
    Sync: '🔄',
};

function formatDuration(start: string, end: string | null): string {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function formatTime(dateStr: string): string {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return '-';
    return new Date(dateStr).toLocaleString();
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec: number): string {
    return formatBytes(bytesPerSec) + '/s';
}

function formatEta(etaSeconds: number | null | undefined): string {
    if (etaSeconds == null || etaSeconds <= 0) return '-';
    if (etaSeconds < 60) return `${etaSeconds}s`;
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = etaSeconds % 60;
    if (minutes < 60) return `${minutes}m ${seconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

export default function Jobs() {
    const [tasks, setTasks] = useState<RTask[]>([]);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadTasks = async () => {
        try {
            const data = await api.getTasks();
            setTasks(data);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
        intervalRef.current = setInterval(() => {
            loadTasks();
        }, 2000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const handleStop = async (id: string) => {
        try {
            await api.stopTask(id);
            loadTasks();
        } catch (err) {
            alert(`Failed to stop task: ${err}`);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            alert(`Failed to delete task: ${err}`);
        }
    };

    const handleClearCompleted = async () => {
        try {
            await api.clearCompletedTasks();
            loadTasks();
        } catch (err) {
            alert(`Failed to clear tasks: ${err}`);
        }
    };

    const handleRestart = async (id: string) => {
        try {
            await api.restartTask(id);
            loadTasks();
        } catch (err) {
            alert(`Failed to restart task: ${err}`);
        }
    };

    const runningCount = tasks.filter(t => t.status === 'Running').length;
    const queuedCount = tasks.filter(t => t.status === 'Queued').length;

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Jobs</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {runningCount > 0 || queuedCount > 0
                            ? `${runningCount} running${queuedCount > 0 ? ` · ${queuedCount} queued` : ''} · ${tasks.length} total`
                            : `${tasks.length} total`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadTasks}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition"
                    >
                        Refresh
                    </button>
                    {tasks.some(t => t.status !== 'Running' && t.status !== 'Pending') && (
                        <button
                            onClick={handleClearCompleted}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition text-red-600 dark:text-red-400"
                        >
                            Clear Finished
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <p className="text-xl text-gray-400">No jobs yet</p>
                        <p className="text-sm text-gray-500 mt-2">Copy, move, and sync operations will appear here.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {tasks.map(task => {
                        const stats = task.stats;
                        const progressPercent = stats && stats.totalBytes > 0
                            ? Math.min(100, Math.round((stats.bytes / stats.totalBytes) * 100))
                            : stats && stats.totalTransfers > 0
                                ? Math.min(100, Math.round((stats.transfers / stats.totalTransfers) * 100))
                                : null;

                        return (
                            <div
                                key={task.id}
                                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow transition"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left side */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <span className="text-2xl flex-shrink-0 mt-0.5">
                                            {TYPE_ICONS[task.type] || '📄'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-gray-800 dark:text-white">
                                                    {task.type}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || STATUS_COLORS.Unknown}`}>
                                                    {task.status}
                                                    {task.status === 'Running' && (
                                                        <span className="ml-1 inline-block animate-pulse">●</span>
                                                    )}
                                                    {task.status === 'Queued' && (
                                                        <span className="ml-1">⏳</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-gray-400 flex-shrink-0">From:</span>
                                                    <span className="truncate font-mono text-xs">{task.sourceRemote}:{task.sourcePath}</span>
                                                </div>
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-gray-400 flex-shrink-0">To:</span>
                                                    <span className="truncate font-mono text-xs">{task.destRemote}:{task.destPath}</span>
                                                </div>
                                            </div>

                                            {/* Progress bar & stats for running tasks */}
                                            {task.status === 'Running' && stats && (
                                                <div className="mt-3 space-y-2">
                                                    {/* Progress bar */}
                                                    {progressPercent != null && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${progressPercent}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 w-10 text-right">{progressPercent}%</span>
                                                        </div>
                                                    )}

                                                    {/* Stats grid */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-400">Speed:</span>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{formatSpeed(stats.speed)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-400">Transferred:</span>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{formatBytes(stats.bytes)}{stats.totalBytes > 0 ? ` / ${formatBytes(stats.totalBytes)}` : ''}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-400">Files:</span>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{stats.transfers}{stats.totalTransfers > 0 ? ` / ${stats.totalTransfers}` : ''}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-400">ETA:</span>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{formatEta(stats.eta)}</span>
                                                        </div>
                                                        {stats.errors > 0 && (
                                                            <div className="flex items-center gap-1.5 col-span-2">
                                                                <span className="text-red-400">Errors:</span>
                                                                <span className="font-medium text-red-600 dark:text-red-400">{stats.errors}</span>
                                                            </div>
                                                        )}
                                                        {stats.checks > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-gray-400">Checks:</span>
                                                                <span className="font-medium text-gray-700 dark:text-gray-300">{stats.checks}{stats.totalChecks > 0 ? ` / ${stats.totalChecks}` : ''}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Currently transferring files */}
                                                    {stats.transferring && stats.transferring.length > 0 && (
                                                        <div className="mt-1 space-y-1">
                                                            {stats.transferring.slice(0, 3).map((t, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                                                                    <span className="truncate flex-1 font-mono">{t.name}</span>
                                                                    <span className="flex-shrink-0">{t.percentage}%</span>
                                                                    <span className="flex-shrink-0 w-16 text-right">{formatSpeed(t.speed)}</span>
                                                                    <span className="flex-shrink-0 w-20 text-right">{formatBytes(t.bytes)} / {formatBytes(t.size)}</span>
                                                                </div>
                                                            ))}
                                                            {stats.transferring.length > 3 && (
                                                                <p className="text-xs text-gray-400 px-2">...and {stats.transferring.length - 3} more</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {task.error && (
                                                <div className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                                                    {task.error}
                                                </div>
                                            )}
                                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                                <span>Created: {formatTime(task.createdAt)}</span>
                                                {task.startedAt && <span>Started: {formatTime(task.startedAt)}</span>}
                                                {task.startedAt && <span>Duration: {formatDuration(task.startedAt, task.finishedAt)}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right side - actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {(task.status === 'Running' || task.status === 'Queued') && (
                                            <button
                                                onClick={() => handleStop(task.id)}
                                                className="px-3 py-1.5 text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition"
                                            >
                                                Stop
                                            </button>
                                        )}
                                        {(task.status === 'Stopped' || task.status === 'Failed' || task.status === 'Unknown') && (
                                            <button
                                                onClick={() => handleRestart(task.id)}
                                                className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                            >
                                                Restart
                                            </button>
                                        )}
                                        {task.status !== 'Running' && task.status !== 'Queued' && (
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
