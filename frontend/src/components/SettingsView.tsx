import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Server } from 'lucide-react';

export default function SettingsView() {
    const [providers, setProviders] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newProvider, setNewProvider] = useState({ name: '', base_url: '', api_key: '' });

    const fetchSettings = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const [provRes, modRes] = await Promise.all([
                fetch(`${apiUrl}/api/providers/`),
                fetch(`${apiUrl}/api/models/`)
            ]);
            setProviders(await provRes.json());
            setModels(await modRes.json());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const addProvider = async () => {
        if (!newProvider.name || !newProvider.base_url) return;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            await fetch(`${apiUrl}/api/providers/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProvider)
            });
            setNewProvider({ name: '', base_url: '', api_key: '' });
            fetchSettings();
        } catch (e) {
            console.error(e);
        }
    };

    const syncModels = async (providerId: number) => {
        setIsLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            await fetch(`${apiUrl}/api/providers/${providerId}/sync_models`, { method: 'POST' });
            await fetchSettings();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteProvider = async (id: number) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            await fetch(`${apiUrl}/api/providers/${id}`, { method: 'DELETE' });
            fetchSettings();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="h-full overflow-y-auto w-full p-8 bg-[#0f1115]">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">Providers & Models</h1>
                    <p className="text-sm text-gray-400">Configure your OpenAI-compatible endpoints to start evaluating LLMs.</p>
                </div>

                {/* Add Provider Form */}
                <div className="bg-[#1e2128] border border-[#2d3139] p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Server size={20} className="text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Add New Provider</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block">Provider Name</label>
                            <input
                                type="text" placeholder="e.g. OpenAI, Together AI"
                                className="w-full bg-[#0f1115] border border-[#2d3139] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
                                value={newProvider.name} onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block">Base URL</label>
                            <input
                                type="text" placeholder="https://api.openai.com/v1"
                                className="w-full bg-[#0f1115] border border-[#2d3139] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
                                value={newProvider.base_url} onChange={e => setNewProvider({ ...newProvider, base_url: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block">API Key</label>
                            <input
                                type="password" placeholder="sk-..."
                                className="w-full bg-[#0f1115] border border-[#2d3139] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
                                value={newProvider.api_key} onChange={e => setNewProvider({ ...newProvider, api_key: e.target.value })}
                            />
                        </div>
                    </div>
                    <button
                        onClick={addProvider}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Add Provider
                    </button>
                </div>

                {/* Existing Providers */}
                <div className="space-y-6">
                    {providers.map(p => {
                        const providerModels = models.filter(m => m.provider_id === p.id);
                        return (
                            <div key={p.id} className="bg-[#16181d] border border-[#2d3139] p-6 rounded-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                            {p.name}
                                            <span className="text-xs font-normal text-gray-500 bg-[#2d3139] px-2 py-1 rounded-full">{p.base_url}</span>
                                        </h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => syncModels(p.id)} disabled={isLoading}
                                            className="flex items-center gap-2 bg-[#2d3139] hover:bg-[#3b414d] text-gray-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                        >
                                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Sync Models
                                        </button>
                                        <button
                                            onClick={() => deleteProvider(p.id)}
                                            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {providerModels.length === 0 && <span className="text-sm text-gray-500 col-span-full italic">No models found. Try syncing.</span>}
                                    {providerModels.map(m => (
                                        <div key={m.id} className="bg-[#0f1115] border border-[#2d3139] rounded-lg p-3 flex flex-col justify-between group">
                                            <div className="text-sm font-medium truncate text-gray-200" title={m.name || m.model_id}>{m.name || m.model_id}</div>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-[10px] text-gray-500 truncate">{m.model_id}</span>
                                                {m.is_reasoning && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded box-border font-medium">Reasoning</span>}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Manually Add Model button could go here */}
                                    {providerModels.length > 0 && (
                                        <div className="bg-[#0f1115] border border-dashed border-[#2d3139] hover:border-blue-500/50 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors">
                                            <Plus size={20} className="mb-1" />
                                            <span className="text-xs font-medium">Add Manual</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
