import { useEffect, useState } from 'react';
import { api, type ShareResponse, type CreateShareRequest, type UpdateShareRequest, type ShareRecipient } from './api';
import { useToast } from './Toast';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ShareLink({ shareId }: { shareId: string }) {
    const [copied, setCopied] = useState(false);
    const url = `${window.location.origin}/s/${shareId}`;

    const copy = () => {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button onClick={copy} className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center gap-1" title={url}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            {copied ? 'Copied!' : 'Copy link'}
        </button>
    );
}

interface ShareFormData {
    Name: string;
    Description: string;
    Remote: string;
    Path: string;
    Password: string;
    Expiration: string;
    MaxDownloads: number;
    IsPublic: boolean;
    Recipients: ShareRecipient[];
}

const emptyForm: ShareFormData = {
    Name: '',
    Description: '',
    Remote: '',
    Path: '',
    Password: '',
    Expiration: '',
    MaxDownloads: 0,
    IsPublic: true,
    Recipients: [],
};

function ShareFormModal({
    isOpen,
    title,
    initialData,
    remotes,
    showRemotePath,
    onSave,
    onCancel,
}: {
    isOpen: boolean;
    title: string;
    initialData: ShareFormData;
    remotes: string[];
    showRemotePath: boolean;
    onSave: (data: ShareFormData) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState<ShareFormData>(initialData);
    const [recipientEmail, setRecipientEmail] = useState('');

    useEffect(() => {
        setForm(initialData);
    }, [initialData]);

    if (!isOpen) return null;

    const addRecipient = () => {
        if (!recipientEmail.trim()) return;
        if (form.Recipients.some(r => r.email === recipientEmail.trim())) return;
        setForm({ ...form, Recipients: [...form.Recipients, { email: recipientEmail.trim(), permission: 'Read' }] });
        setRecipientEmail('');
    };

    const removeRecipient = (email: string) => {
        setForm({ ...form, Recipients: form.Recipients.filter(r => r.email !== email) });
    };

    const updateRecipientPermission = (email: string, permission: string) => {
        setForm({
            ...form,
            Recipients: form.Recipients.map(r =>
                r.email === email ? { ...r, permission } : r
            ),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={form.Name}
                            onChange={e => setForm({ ...form, Name: e.target.value })}
                            placeholder="My shared folder"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={form.Description}
                            onChange={e => setForm({ ...form, Description: e.target.value })}
                            placeholder="Optional description..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>

                    {showRemotePath && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remote</label>
                                <select
                                    value={form.Remote}
                                    onChange={e => setForm({ ...form, Remote: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select remote</option>
                                    {remotes.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Path</label>
                                <input
                                    type="text"
                                    value={form.Path}
                                    onChange={e => setForm({ ...form, Path: e.target.value })}
                                    placeholder="folder/subfolder"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (optional)</label>
                            <input
                                type="password"
                                value={form.Password}
                                onChange={e => setForm({ ...form, Password: e.target.value })}
                                placeholder="Leave empty for none"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max downloads</label>
                            <input
                                type="number"
                                min={0}
                                value={form.MaxDownloads}
                                onChange={e => setForm({ ...form, MaxDownloads: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiration (optional)</label>
                        <input
                            type="datetime-local"
                            value={form.Expiration}
                            onChange={e => setForm({ ...form, Expiration: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.IsPublic}
                                onChange={e => setForm({ ...form, IsPublic: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Public (anyone with the link)</span>
                    </div>

                    {/* Recipients */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recipients</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="email"
                                value={recipientEmail}
                                onChange={e => setRecipientEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                                placeholder="email@example.com"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            <button onClick={addRecipient} className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 text-sm font-medium">
                                Add
                            </button>
                        </div>
                        {form.Recipients.length > 0 && (
                            <div className="space-y-1">
                                {form.Recipients.map(r => (
                                    <div key={r.email} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{r.email}</span>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={r.permission}
                                                onChange={e => updateRecipientPermission(r.email, e.target.value)}
                                                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                            >
                                                <option value="Read">Read</option>
                                                <option value="Write">Write</option>
                                            </select>
                                            <button onClick={() => removeRecipient(r.email)} className="text-red-500 hover:text-red-700 text-sm">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition text-sm font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={showRemotePath && !form.Remote}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Shares() {
    const [shares, setShares] = useState<ShareResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [remotes, setRemotes] = useState<string[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editingShare, setEditingShare] = useState<ShareResponse | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const { showError, showSuccess } = useToast();

    useEffect(() => {
        loadShares();
        api.getRemotes().then(setRemotes).catch(() => {});
    }, []);

    async function loadShares() {
        try {
            setLoading(true);
            const data = await api.getShares();
            setShares(data);
        } catch (err: any) {
            showError(`Failed to load shares: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(form: ShareFormData) {
        try {
            const req: CreateShareRequest = {
                remote: form.Remote,
                path: form.Path,
                name: form.Name,
                description: form.Description,
                password: form.Password || undefined,
                expiration: form.Expiration ? new Date(form.Expiration).toISOString() : undefined,
                maxDownloads: form.MaxDownloads,
                isPublic: form.IsPublic,
                recipients: form.Recipients,
            };
            await api.createShare(req);
            showSuccess('Share created');
            setShowCreate(false);
            loadShares();
        } catch (err: any) {
            showError(`Failed to create share: ${err.message}`);
        }
    }

    async function handleUpdate(form: ShareFormData) {
        if (!editingShare) return;
        try {
            const req: UpdateShareRequest = {
                name: form.Name,
                description: form.Description,
                password: form.Password || undefined,
                expiration: form.Expiration ? new Date(form.Expiration).toISOString() : undefined,
                maxDownloads: form.MaxDownloads,
                isPublic: form.IsPublic,
                recipients: form.Recipients,
            };
            await api.updateShare(editingShare.id, req);
            showSuccess('Share updated');
            setEditingShare(null);
            loadShares();
        } catch (err: any) {
            showError(`Failed to update share: ${err.message}`);
        }
    }

    async function handleDelete(id: string) {
        try {
            await api.deleteShare(id);
            showSuccess('Share deleted');
            setDeleteConfirm(null);
            loadShares();
        } catch (err: any) {
            showError(`Failed to delete share: ${err.message}`);
        }
    }

    const editFormData = editingShare ? {
        Name: editingShare.name,
        Description: editingShare.description,
        Remote: editingShare.remote,
        Path: editingShare.path,
        Password: '',
        Expiration: editingShare.expiration ? new Date(editingShare.expiration).toISOString().slice(0, 16) : '',
        MaxDownloads: editingShare.maxDownloads,
        IsPublic: editingShare.isPublic,
        Recipients: editingShare.recipients || [],
    } : emptyForm;

    if (loading) {
        return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading shares...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Shares</h2>
                <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    New Share
                </button>
            </div>

            {shares.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        <p className="text-xl text-gray-400 dark:text-gray-500">No shares yet</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a share to give others access to your files.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {shares.map(share => (
                        <div key={share.id} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                            {share.name || `${share.remote}:${share.path}`}
                                        </h3>
                                        {share.isPublic ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Public</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Restricted</span>
                                        )}
                                        {share.hasPassword && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                Password
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{share.remote}:{share.path || '/'}</span>
                                    </p>
                                    {share.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{share.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                        <span>Created {formatDate(share.createdAt)}</span>
                                        {share.expiration && <span>Expires {formatDate(share.expiration)}</span>}
                                        {share.maxDownloads > 0 && <span>Max {share.maxDownloads} downloads</span>}
                                        <span>{share.views} views</span>
                                        {share.recipients?.length > 0 && <span>{share.recipients.length} recipient{share.recipients.length > 1 ? 's' : ''}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <ShareLink shareId={share.id} />
                                    <button
                                        onClick={() => setEditingShare(share)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                        title="Edit"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(share.Id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create modal */}
            <ShareFormModal
                isOpen={showCreate}
                title="Create Share"
                initialData={emptyForm}
                remotes={remotes}
                showRemotePath={true}
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
            />

            {/* Edit modal */}
            <ShareFormModal
                isOpen={!!editingShare}
                title="Edit Share"
                initialData={editFormData}
                remotes={remotes}
                showRemotePath={false}
                onSave={handleUpdate}
                onCancel={() => setEditingShare(null)}
            />

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Share</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure? This will revoke access for anyone using this share link.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition text-sm font-medium">
                                Cancel
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
