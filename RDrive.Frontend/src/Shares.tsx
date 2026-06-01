import { useEffect, useState } from 'react';
import { api, type ShareResponse, type CreateShareRequest, type UpdateShareRequest } from './api';
import { useToast } from './Toast';
import { ShareFormModal, emptyForm, type ShareFormData } from './components/ShareFormModal';

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
        <button onClick={copy} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm" title={url}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            {copied ? 'Copied!' : 'Copy link'}
        </button>
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
            <div className="flex justify-between items-start sm:items-center gap-3 mb-8">
                <div className="min-w-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-1">Shares</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Share your files securely with others</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary flex items-center gap-2 text-sm shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    New Share
                </button>
            </div>

            {shares.length === 0 ? (
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-sm min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center p-8">
                        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </div>
                        <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No shares yet</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Create a share to give others access to your files</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {shares.map(share => (
                        <div key={share.id} className="card-elevated p-6 hover:shadow-lg group">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg">
                                            {share.name || `${share.remote}:${share.path}`}
                                        </h3>
                                        {share.isPublic ? (
                                            <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Public</span>
                                        ) : (
                                            <span className="badge bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Restricted</span>
                                        )}
                                        {share.hasPassword && (
                                            <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                Protected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700/70 px-2 py-1 rounded">{share.remote}:{share.path || '/'}</span>
                                    </p>
                                    {share.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{share.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                            {formatDate(share.createdAt)}
                                        </span>
                                        {share.expiration && (
                                            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                Expires {formatDate(share.expiration)}
                                            </span>
                                        )}
                                        {share.maxDownloads > 0 && <span>Max {share.maxDownloads} downloads</span>}
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                            {share.views} views
                                        </span>
                                        {share.recipients && share.recipients.length > 0 && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                                {share.recipients.length} recipient{share.recipients.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <ShareLink shareId={share.id} />
                                    <button
                                        onClick={() => setEditingShare(share)}
                                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                        title="Edit"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(share.id)}
                                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
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
