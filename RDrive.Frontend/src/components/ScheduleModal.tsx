import { useState } from 'react';
import { api, type ScheduledJobRequest } from '../api';
import { useToast } from '../Toast';

interface ScheduleModalProps {
    remotes: string[];
    initial?: Partial<ScheduledJobRequest>;
    editingId?: string | null;
    onSaved: () => void;
    onClose: () => void;
}

type OpType = 'Copy' | 'Move' | 'Sync';

export function ScheduleModal({ remotes, initial, editingId, onSaved, onClose }: ScheduleModalProps) {
    const { showError, showSuccess } = useToast();

    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState<OpType>((initial?.type as OpType) || 'Sync');
    const [sourceRemote, setSourceRemote] = useState(initial?.sourceRemote ?? '');
    const [sourcePath, setSourcePath] = useState(initial?.sourcePath ?? '');
    const [destRemote, setDestRemote] = useState(initial?.destRemote ?? '');
    const [destPath, setDestPath] = useState(initial?.destPath ?? '');
    const [cron, setCron] = useState(initial?.cronExpression ?? '');
    const [transfers, setTransfers] = useState(initial?.transfers != null ? String(initial.transfers) : '');
    const [bwLimit, setBwLimit] = useState(initial?.bwLimit ?? '');
    const [enabled, setEnabled] = useState(initial?.enabled ?? true);
    const [isDir, setIsDir] = useState(initial?.isDir ?? true);
    const [loading, setLoading] = useState(false);

    const canSubmit = !!sourceRemote && !!destRemote && !!cron.trim();

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setLoading(true);
        const req: ScheduledJobRequest = {
            name: name.trim() || null,
            type,
            isDir: type === 'Sync' ? true : isDir,
            sourceRemote,
            sourcePath: sourcePath.trim(),
            destRemote,
            destPath: destPath.trim(),
            cronExpression: cron.trim(),
            transfers: transfers.trim() ? parseInt(transfers, 10) : null,
            bwLimit: bwLimit.trim() || null,
            enabled,
        };
        try {
            if (editingId) {
                await api.updateScheduledJob(editingId, req);
                showSuccess('Scheduled job updated');
            } else {
                await api.createScheduledJob(req);
                showSuccess('Scheduled job created');
            }
            onSaved();
            onClose();
        } catch (err: any) {
            showError(err.message || 'Failed to save scheduled job');
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
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {editingId ? 'Edit Scheduled Job' : 'New Scheduled Job'}
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name <span className="text-gray-400">(optional)</span></label>
                        <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Nightly backup" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Operation</label>
                        <select className="input-field" value={type} onChange={e => setType(e.target.value as OpType)}>
                            <option value="Sync">Sync</option>
                            <option value="Copy">Copy</option>
                            <option value="Move">Move</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Remote</label>
                            <select className="input-field" value={sourceRemote} onChange={e => setSourceRemote(e.target.value)}>
                                <option value="">Select...</option>
                                {remotes.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Path</label>
                            <input type="text" className="input-field" value={sourcePath} onChange={e => setSourcePath(e.target.value)} placeholder="folder/subfolder" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destination Remote</label>
                            <select className="input-field" value={destRemote} onChange={e => setDestRemote(e.target.value)}>
                                <option value="">Select...</option>
                                {remotes.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destination Path</label>
                            <input type="text" className="input-field" value={destPath} onChange={e => setDestPath(e.target.value)} placeholder="folder/subfolder" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cron Expression</label>
                        <input type="text" className="input-field font-mono" value={cron} onChange={e => setCron(e.target.value)} placeholder="*/30 * * * *" />
                        <p className="text-xs text-gray-500 mt-1">5-field cron (UTC). e.g. <span className="font-mono">0 2 * * *</span> = 02:00 daily, <span className="font-mono">*/30 * * * *</span> = every 30 min.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Concurrent Transfers <span className="text-gray-400">(optional)</span></label>
                            <input type="number" min="1" className="input-field" value={transfers} onChange={e => setTransfers(e.target.value)} placeholder="4" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bandwidth Limit <span className="text-gray-400">(optional)</span></label>
                            <input type="text" className="input-field" value={bwLimit} onChange={e => setBwLimit(e.target.value)} placeholder="10M" />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
                            Enabled
                        </label>
                        {type !== 'Sync' && (
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={isDir} onChange={e => setIsDir(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
                                Source is a directory
                            </label>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-0 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !canSubmit}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Create Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
}
