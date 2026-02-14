import { useEffect, useState, useMemo } from 'react';
import { api } from './api';
import type { Provider, ProviderOption } from './api';
import RcloneTerminal from './RcloneTerminal';
import { useToast } from './Toast';

interface RemoteInfo {
    name: string;
    type: string;
    config: Record<string, string>;
}

export default function RemoteConfig() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { showError, showSuccess } = useToast();

    // Form state
    const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
    const [editingRemote, setEditingRemote] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState('');
    const [formParams, setFormParams] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [providerSearch, setProviderSearch] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [showTerminal, setShowTerminal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [provs, dump] = await Promise.all([
                api.getProviders(),
                api.dumpConfig()
            ]);
            setProviders(provs);

            const remoteInfos: RemoteInfo[] = Object.entries(dump).map(([name, config]) => ({
                name,
                type: config.type || '',
                config
            }));
            setRemotes(remoteInfos);
        } catch (e: any) {
            showError(`Failed to load config: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const selectedProvider = useMemo(() => {
        return providers.find(p => p.Name === formType) || null;
    }, [providers, formType]);

    const visibleOptions = useMemo(() => {
        if (!selectedProvider) return [];
        return selectedProvider.Options.filter(o => {
            if (o.Hide > 0) return false;
            if (!showAdvanced && o.Advanced) return false;
            return true;
        });
    }, [selectedProvider, showAdvanced]);

    const hasAdvancedOptions = useMemo(() => {
        if (!selectedProvider) return false;
        return selectedProvider.Options.some(o => o.Advanced && o.Hide === 0);
    }, [selectedProvider]);

    const filteredProviders = useMemo(() => {
        if (!providerSearch) return providers;
        const q = providerSearch.toLowerCase();
        return providers.filter(p =>
            p.Name.toLowerCase().includes(q) ||
            p.Description.toLowerCase().includes(q)
        );
    }, [providers, providerSearch]);

    const startCreate = () => {
        setMode('create');
        setEditingRemote(null);
        setFormName('');
        setFormType('');
        setFormParams({});
        setShowAdvanced(false);
        setProviderSearch('');
    };

    const startEdit = async (remote: RemoteInfo) => {
        setMode('edit');
        setEditingRemote(remote.name);
        setFormName(remote.name);
        setFormType(remote.type);
        setShowAdvanced(false);
        setProviderSearch('');

        // Load full config
        try {
            const config = await api.getRemoteConfig(remote.name);
            const params = { ...config };
            delete params.type; // type is separate
            setFormParams(params);
        } catch {
            setFormParams({ ...remote.config });
        }
    };

    const cancelForm = () => {
        setMode('list');
        setEditingRemote(null);
        setFormName('');
        setFormType('');
        setFormParams({});
    };

    const handleParamChange = (key: string, value: string) => {
        setFormParams(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            setError('Remote name is required');
            return;
        }
        if (!formType) {
            setError('Provider type is required');
            return;
        }

        setSaving(true);
        setError('');
        try {
            // Filter out empty values
            const params: Record<string, string> = {};
            for (const [k, v] of Object.entries(formParams)) {
                if (v !== '') params[k] = v;
            }

            if (mode === 'create') {
                await api.createRemote(formName.trim(), formType, params);
            } else {
                await api.updateRemote(editingRemote!, params);
            }
            await loadData();
            cancelForm();
            showSuccess(`Remote ${mode === 'create' ? 'created' : 'updated'} successfully`);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (name: string) => {
        try {
            await api.deleteRemote(name);
            setDeleteConfirm(null);
            await loadData();
            showSuccess(`Remote "${name}" deleted`);
        } catch (e: any) {
            showError(`Failed to delete remote: ${e.message}`);
        }
    };

    const getProviderIcon = (type: string) => {
        const icons: Record<string, string> = {
            s3: '☁️', drive: '📁', dropbox: '📦', onedrive: '💎', sftp: '🔐',
            ftp: '📡', b2: '🗄️', swift: '🌊', azureblob: '🟦', gcs: '🟡',
            local: '💻', mega: '📂', box: '📥', pcloud: '☁️', webdav: '🌐',
            crypt: '🔒', union: '🔗', alias: '🏷️', compress: '📦', cache: '⚡',
        };
        return icons[type] || '☁️';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Create/Edit form
    if (mode !== 'list') {
        return (
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={cancelForm} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                        {mode === 'create' ? 'New Remote' : `Edit "${editingRemote}"`}
                    </h2>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6 max-w-3xl">
                    {/* Remote Name */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Remote Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            disabled={mode === 'edit'}
                            placeholder="e.g. mycloud, backup-s3"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-600"
                        />
                        {mode === 'edit' && (
                            <p className="text-xs text-gray-500 mt-1">Name cannot be changed after creation</p>
                        )}
                    </div>

                    {/* Provider Type */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Provider Type <span className="text-red-500">*</span>
                        </label>
                        {mode === 'create' ? (
                            <div>
                                <input
                                    type="text"
                                    value={providerSearch}
                                    onChange={e => setProviderSearch(e.target.value)}
                                    placeholder="Search providers..."
                                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                                    {filteredProviders.map(p => (
                                        <button
                                            key={p.Name}
                                            onClick={() => { setFormType(p.Name); setFormParams({}); }}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm ${formType === p.Name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''}`}
                                        >
                                            <span>{getProviderIcon(p.Name)}</span>
                                            <span className="font-medium">{p.Name}</span>
                                            <span className="text-gray-500 dark:text-gray-400 truncate">— {p.Description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <span>{getProviderIcon(formType)}</span>
                                <span className="font-medium">{formType}</span>
                                <span className="text-gray-500 dark:text-gray-400">— {selectedProvider?.Description || ''}</span>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Options */}
                    {selectedProvider && visibleOptions.length > 0 && (
                        <div className="space-y-4 mb-6">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
                                Configuration Options
                            </h3>
                            {visibleOptions.map(opt => (
                                <OptionField
                                    key={opt.Name}
                                    option={opt}
                                    value={formParams[opt.Name] || ''}
                                    onChange={v => handleParamChange(opt.Name, v)}
                                />
                            ))}
                        </div>
                    )}

                    {hasAdvancedOptions && (
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 block"
                        >
                            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
                        </button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <button
                            onClick={handleSave}
                            disabled={saving || !formName.trim() || !formType}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                            {mode === 'create' ? 'Create Remote' : 'Save Changes'}
                        </button>
                        <button
                            onClick={cancelForm}
                            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Remote list
    return (
        <div>
            {showTerminal && (
                <RcloneTerminal
                    onClose={() => setShowTerminal(false)}
                    onDone={() => loadData()}
                />
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Configure Remotes</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTerminal(true)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        rclone config
                    </button>
                    <button
                        onClick={startCreate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        New Remote
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {remotes.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <p className="text-xl text-gray-400 mb-2">No remotes configured</p>
                        <p className="text-sm text-gray-500 mb-4">Create a new remote to get started</p>
                        <button
                            onClick={startCreate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            New Remote
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {remotes.map(remote => (
                        <div
                            key={remote.name}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-xl">
                                    {getProviderIcon(remote.type)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-white">{remote.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{remote.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => startEdit(remote)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    Edit
                                </button>
                                {deleteConfirm === remote.name ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleDelete(remote.name)}
                                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(remote.name)}
                                        className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function OptionField({ option, value, onChange }: { option: ProviderOption; value: string; onChange: (v: string) => void }) {
    const helpFirstLine = option.Help?.split('\n')[0] || '';
    const defaultStr = option.Default != null && option.Default !== '' ? String(option.Default) : '';

    // If exclusive with examples, render as select
    if (option.Exclusive && option.Examples && option.Examples.length > 0) {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {option.Name}
                    {option.Required && <span className="text-red-500 ml-1">*</span>}
                    {option.Advanced && <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Advanced</span>}
                </label>
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">{defaultStr ? `Default: ${defaultStr}` : 'Select...'}</option>
                    {option.Examples.map((ex, i) => (
                        <option key={i} value={ex.Value}>
                            {ex.Value}{ex.Help ? ` — ${ex.Help}` : ''}
                        </option>
                    ))}
                </select>
                {helpFirstLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpFirstLine}</p>}
            </div>
        );
    }

    // If has examples but not exclusive, render as input with datalist
    if (option.Examples && option.Examples.length > 0) {
        const listId = `opt-${option.Name}`;
        return (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {option.Name}
                    {option.Required && <span className="text-red-500 ml-1">*</span>}
                    {option.Advanced && <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Advanced</span>}
                </label>
                <input
                    type={option.IsPassword ? 'password' : 'text'}
                    list={listId}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={defaultStr ? `Default: ${defaultStr}` : ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <datalist id={listId}>
                    {option.Examples.map((ex, i) => (
                        <option key={i} value={ex.Value}>{ex.Help}</option>
                    ))}
                </datalist>
                {helpFirstLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpFirstLine}</p>}
            </div>
        );
    }

    // Boolean-like with "true"/"false" default
    if (defaultStr === 'true' || defaultStr === 'false') {
        return (
            <div>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={value ? value === 'true' : defaultStr === 'true'}
                        onChange={e => onChange(e.target.checked ? 'true' : 'false')}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {option.Name}
                        {option.Advanced && <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Advanced</span>}
                    </span>
                </label>
                {helpFirstLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">{helpFirstLine}</p>}
            </div>
        );
    }

    // Default: text or password input
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {option.Name}
                {option.Required && <span className="text-red-500 ml-1">*</span>}
                {option.IsPassword && <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">Password</span>}
                {option.Advanced && <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Advanced</span>}
            </label>
            <input
                type={option.IsPassword ? 'password' : 'text'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={defaultStr ? `Default: ${defaultStr}` : ''}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {helpFirstLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpFirstLine}</p>}
        </div>
    );
}
