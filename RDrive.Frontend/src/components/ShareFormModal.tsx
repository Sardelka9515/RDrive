import { useEffect, useState } from 'react';
import type { ShareRecipient } from '../api';

export interface ShareFormData {
    Name: string;
    Description: string;
    Remote: string;
    Path: string;
    Password: string;
    Expiration: string;
    MaxDownloads: number;
    IsPublic: boolean;
    AllowWrite: boolean;
    Recipients: ShareRecipient[];
}

export const emptyForm: ShareFormData = {
    Name: '',
    Description: '',
    Remote: '',
    Path: '',
    Password: '',
    Expiration: '',
    MaxDownloads: 0,
    IsPublic: true,
    AllowWrite: false,
    Recipients: [],
};

export function ShareFormModal({
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent">
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
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={form.Description}
                            onChange={e => setForm({ ...form, Description: e.target.value })}
                            placeholder="Optional description..."
                            rows={2}
                            className="input-field resize-none"
                        />
                    </div>

                    {showRemotePath && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remote</label>
                                <select
                                    value={form.Remote}
                                    onChange={e => setForm({ ...form, Remote: e.target.value })}
                                    className="input-field"
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
                                    className="input-field"
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

                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.AllowWrite}
                                onChange={e => setForm({ ...form, AllowWrite: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow editing (visitors can upload &amp; modify files)</span>
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

                <div className="p-6 pt-0 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700 mt-6">
                    <button onClick={onCancel} className="btn-secondary text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={showRemotePath && !form.Remote}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
