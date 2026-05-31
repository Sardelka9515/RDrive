import { useEffect, useState, useRef } from 'react';
import { api, type RTask, type ScheduledJob, type ScheduledJobRequest } from './api';
import { useToast } from './Toast';
import { ScheduleModal } from './components/ScheduleModal';

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
    const [scheduled, setScheduled] = useState<ScheduledJob[]>([]);
    const [remotes, setRemotes] = useState<string[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalInitial, setModalInitial] = useState<Partial<ScheduledJobRequest> | undefined>(undefined);
    const [editingId, setEditingId] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { showError, showSuccess } = useToast();

    const loadTasks = async () => {
        try {
            const data = await api.getTasks();
            setTasks(data);
        } catch (err: any) {
            showError(`Failed to load tasks: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadScheduled = async () => {
        try {
            setScheduled(await api.getScheduledJobs());
        } catch (err: any) {
            showError(`Failed to load scheduled jobs: ${err.message}`);
        }
    };

    useEffect(() => {
        loadTasks();
        loadScheduled();
        api.getRemotes().then(setRemotes).catch(() => { /* non-fatal */ });
        intervalRef.current = setInterval(() => {
            loadTasks();
            loadScheduled();
        }, 2000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const openNewSchedule = () => {
        setModalInitial(undefined);
        setEditingId(null);
        setModalOpen(true);
    };

    const openEditSchedule = (job: ScheduledJob) => {
        setModalInitial({
            name: job.name,
            type: job.type,
            isDir: job.isDir,
            sourceRemote: job.sourceRemote,
            sourcePath: job.sourcePath,
            destRemote: job.destRemote,
            destPath: job.destPath,
            cronExpression: job.cronExpression,
            transfers: job.transfers,
            bwLimit: job.bwLimit,
            enabled: job.enabled,
        });
        setEditingId(job.id);
        setModalOpen(true);
    };

    const scheduleFromTask = (task: RTask) => {
        setModalInitial({
            type: task.type,
            isDir: task.isDir,
            sourceRemote: task.sourceRemote,
            sourcePath: task.sourcePath,
            destRemote: task.destRemote,
            destPath: task.destPath,
            enabled: true,
        });
        setEditingId(null);
        setModalOpen(true);
    };

    const handleToggleSchedule = async (id: string) => {
        try {
            await api.toggleScheduledJob(id);
            loadScheduled();
        } catch (err: any) {
            showError(`Failed to toggle schedule: ${err.message}`);
        }
    };

    const handleRunNow = async (id: string) => {
        try {
            await api.runScheduledJobNow(id);
            showSuccess('Run started. Check the job list below.');
            loadTasks();
            loadScheduled();
        } catch (err: any) {
            showError(`Failed to run now: ${err.message}`);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm('Delete this scheduled job? Existing/running tasks are not affected.')) return;
        try {
            await api.deleteScheduledJob(id);
            setScheduled(prev => prev.filter(s => s.id !== id));
        } catch (err: any) {
            showError(`Failed to delete schedule: ${err.message}`);
        }
    };

    const handleStop = async (id: string) => {
        try {
            await api.stopTask(id);
            loadTasks();
        } catch (err: any) {
            showError(`Failed to stop task: ${err.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            showError(`Failed to delete task: ${err.message}`);
        }
    };

    const handleClearCompleted = async () => {
        try {
            await api.clearCompletedTasks();
            loadTasks();
        } catch (err: any) {
            showError(`Failed to clear tasks: ${err.message}`);
        }
    };

    const handleRestart = async (id: string) => {
        try {
            await api.restartTask(id);
            loadTasks();
        } catch (err: any) {
            showError(`Failed to restart task: ${err.message}`);
        }
    };

    const runningCount = tasks.filter(t => t.status === 'Running').length;
    const queuedCount = tasks.filter(t => t.status === 'Queued').length;

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-1">Jobs</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {runningCount > 0 || queuedCount > 0
                            ? `${runningCount} running${queuedCount > 0 ? ` · ${queuedCount} queued` : ''} · ${tasks.length} total`
                            : `${tasks.length} total jobs`}
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={openNewSchedule}
                        className="btn-primary text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        New Scheduled Job
                    </button>
                    <button
                        onClick={loadTasks}
                        className="btn-secondary text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                    {tasks.some(t => t.status !== 'Running' && t.status !== 'Pending') && (
                        <button
                            onClick={handleClearCompleted}
                            className="btn-danger text-sm"
                        >
                            Clear Finished
                        </button>
                    )}
                </div>
            </div>

            {/* Scheduled jobs */}
            {scheduled.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Scheduled</h3>
                    <div className="space-y-3">
                        {scheduled.map(job => (
                            <div key={job.id} className={`card-elevated p-4 ${job.enabled ? '' : 'opacity-60'}`}>
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md flex-shrink-0">
                                            {TYPE_ICONS[job.type] || '📄'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-bold text-gray-800 dark:text-white">{job.name || job.type}</span>
                                                <span className="badge bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 font-mono">{job.cronExpression}</span>
                                                {!job.enabled && <span className="badge bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Disabled</span>}
                                                {job.transfers != null && <span className="badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">⇅ {job.transfers}</span>}
                                                {job.bwLimit && <span className="badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">⤓ {job.bwLimit}</span>}
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                                                {job.sourceRemote}:{job.sourcePath} → {job.destRemote}:{job.destPath}
                                            </div>
                                            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span>Next: {job.enabled ? formatTime(job.nextRunAt || '') : '—'}</span>
                                                {job.lastRunAt && <span>Last: {formatTime(job.lastRunAt)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                        <button onClick={() => handleRunNow(job.id)} className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all font-medium">Run now</button>
                                        <button onClick={() => handleToggleSchedule(job.id)} className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all font-medium">{job.enabled ? 'Disable' : 'Enable'}</button>
                                        <button onClick={() => openEditSchedule(job)} className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all font-medium">Edit</button>
                                        <button onClick={() => handleDeleteSchedule(job.id)} className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all font-medium">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700"></div>
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
                    </div>
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-sm min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center p-8">
                        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </div>
                        <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No jobs yet</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Copy, move, and sync operations will appear here</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
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
                                className="card-elevated p-4 md:p-5 hover:shadow-lg group"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    {/* Left side */}
                                    <div className="flex items-start gap-4 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-500/30 flex-shrink-0">
                                            {TYPE_ICONS[task.type] || '📄'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-bold text-gray-800 dark:text-white text-lg">
                                                    {task.type}
                                                </span>
                                                <span className={`badge ${STATUS_COLORS[task.status] || STATUS_COLORS.Unknown}`}>
                                                    {task.status}
                                                    {task.status === 'Running' && (
                                                        <span className="ml-1 inline-block animate-pulse">●</span>
                                                    )}
                                                    {task.status === 'Queued' && (
                                                        <span className="ml-1">⏳</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                                    <span className="truncate font-mono text-xs bg-gray-100 dark:bg-gray-700/70 px-2 py-0.5 rounded">{task.sourceRemote}:{task.sourcePath}</span>
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                                                    <span className="truncate font-mono text-xs bg-gray-100 dark:bg-gray-700/70 px-2 py-0.5 rounded">{task.destRemote}:{task.destPath}</span>
                                                </div>
                                            </div>

                                            {/* Progress bar & stats for running tasks */}
                                            {task.status === 'Running' && stats && (
                                                <div className="mt-3 space-y-2">
                                                    {/* Progress bar */}
                                                    {progressPercent != null && (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 shadow-sm"
                                                                    style={{ width: `${progressPercent}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 w-12 text-right">{progressPercent}%</span>
                                                        </div>
                                                    )}

                                                    {/* Stats grid */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                                            <div>
                                                                <div className="text-gray-400">Speed</div>
                                                                <div className="font-bold text-gray-700 dark:text-gray-200">{formatSpeed(stats.speed)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                                            <div>
                                                                <div className="text-gray-400">Transferred</div>
                                                                <div className="font-bold text-gray-700 dark:text-gray-200">{formatBytes(stats.bytes)}{stats.totalBytes > 0 ? ` / ${formatBytes(stats.totalBytes)}` : ''}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                                            <div>
                                                                <div className="text-gray-400">Files</div>
                                                                <div className="font-bold text-gray-700 dark:text-gray-200">{stats.transfers}{stats.totalTransfers > 0 ? ` / ${stats.totalTransfers}` : ''}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                            <div>
                                                                <div className="text-gray-400">ETA</div>
                                                                <div className="font-bold text-gray-700 dark:text-gray-200">{formatEta(stats.eta)}</div>
                                                            </div>
                                                        </div>
                                                        {stats.errors > 0 && (
                                                            <div className="flex items-center gap-2 col-span-2">
                                                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                                <div>
                                                                    <div className="text-red-400">Errors</div>
                                                                    <div className="font-bold text-red-600 dark:text-red-400">{stats.errors}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {stats.checks > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                                <div>
                                                                    <div className="text-gray-400">Checks</div>
                                                                    <div className="font-bold text-gray-700 dark:text-gray-300">{stats.checks}{stats.totalChecks > 0 ? ` / ${stats.totalChecks}` : ''}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Currently transferring files */}
                                                    {stats.transferring && stats.transferring.length > 0 && (
                                                        <div className="mt-1">
                                                            <div className="text-xs text-gray-400 mb-1 px-0.5">Transferring ({stats.transferring.length})</div>
                                                            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                                                {stats.transferring.map((t, i) => (
                                                                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                                                                        <span className="truncate flex-1 font-mono">{t.name}</span>
                                                                        <span className="flex-shrink-0">{t.percentage}%</span>
                                                                        <span className="flex-shrink-0 w-16 text-right">{formatSpeed(t.speed)}</span>
                                                                        <span className="flex-shrink-0 w-20 text-right">{formatBytes(t.bytes)} / {formatBytes(t.size)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Error count for non-running tasks (running tasks show it in the stats grid above) */}
                                            {task.status !== 'Running' && stats && stats.errors > 0 && (
                                                <div className="mt-3 flex items-center gap-2 text-sm">
                                                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                    <span className="text-gray-400">Errors</span>
                                                    <span className="font-bold text-red-600 dark:text-red-400">{stats.errors}</span>
                                                </div>
                                            )}

                                            {task.error && (
                                                <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
                                                    <div className="flex items-start gap-2">
                                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                        <span className="whitespace-pre-wrap break-words">{task.error}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span>Created: {formatTime(task.createdAt)}</span>
                                                {task.startedAt && <span>Started: {formatTime(task.startedAt)}</span>}
                                                {task.startedAt && <span>Duration: {formatDuration(task.startedAt, task.finishedAt)}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right side - actions */}
                                    <div className="flex items-start gap-2 flex-wrap flex-shrink-0">
                                        <button
                                            onClick={() => scheduleFromTask(task)}
                                            title="Create a recurring schedule from this job"
                                            className="px-4 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all font-medium shadow-sm"
                                        >
                                            Schedule
                                        </button>
                                        {(task.status === 'Running' || task.status === 'Queued') && (
                                            <button
                                                onClick={() => handleStop(task.id)}
                                                className="px-4 py-2 text-sm bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-all font-medium shadow-sm"
                                            >
                                                Stop
                                            </button>
                                        )}
                                        {(task.status === 'Stopped' || task.status === 'Failed' || task.status === 'Unknown') && (
                                            <button
                                                onClick={() => handleRestart(task.id)}
                                                className="px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all font-medium shadow-sm"
                                            >
                                                Restart
                                            </button>
                                        )}
                                        {task.status !== 'Running' && task.status !== 'Queued' && (
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-700 transition-all font-medium shadow-sm"
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

            {modalOpen && (
                <ScheduleModal
                    remotes={remotes}
                    initial={modalInitial}
                    editingId={editingId}
                    onClose={() => setModalOpen(false)}
                    onSaved={loadScheduled}
                />
            )}
        </div>
    );
}
