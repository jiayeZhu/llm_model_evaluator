import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Send, Settings2, Cpu, Clock, Zap, Copy, Edit2, RotateCw } from 'lucide-react';

export default function ChatView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
    const [selectedModels, setSelectedModels] = useState<number[]>([]);
    const [allModels, setAllModels] = useState<any[]>([]);
    const [providers, setProviders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Fetch models and providers on mount
    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        Promise.all([
            fetch(`${apiUrl}/api/models/`).then(res => res.json()),
            fetch(`${apiUrl}/api/providers/`).then(res => res.json())
        ])
            .then(([modelsData, providersData]) => {
                setAllModels(modelsData || []);
                setProviders(providersData || []);
            })
            .catch(err => console.error(err));
    }, []);

    // Fetch conversation if id exists
    useEffect(() => {
        if (id) {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            fetch(`${apiUrl}/api/conversations/${id}`)
                .then(res => res.json())
                .then(data => {
                    setSystemPrompt(data.system_prompt || 'You are a helpful assistant.');
                    setMessages(data.messages || []);
                })
                .catch(err => console.error(err));
        } else {
            setMessages([]);
            setSystemPrompt('You are a helpful assistant.');
        }
    }, [id]);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleRegenerate = async (messageId: number) => {
        if (!id) return;

        // Optimistically clear the message content and hide its metadata while regenerating
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: '', generation_metadata: null } : m));

        setIsLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/chat/regenerate/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_id: messageId,
                    system_prompt: systemPrompt
                })
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const submitEdit = async (messageId: number) => {
        if (!id || selectedModels.length === 0) return;

        // Optimistically update UI: update the edited message text and remove all subsequent messages immediately
        setMessages(prev => {
            const msgIndex = prev.findIndex(m => m.id === messageId);
            if (msgIndex === -1) return prev;
            const updated = [...prev];
            updated[msgIndex] = { ...updated[msgIndex], content: editContent };
            return updated.slice(0, msgIndex + 1);
        });

        setEditingMessageId(null);
        setIsLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/chat/edit/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: parseInt(id),
                    models_to_use: selectedModels,
                    message_id: messageId,
                    new_content: editContent,
                    system_prompt: systemPrompt
                })
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || selectedModels.length === 0) return;

        setIsLoading(true);
        const userMsg = input;
        setInput('');

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

        try {
            let currentId = id;
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            if (!currentId) {
                const convRes = await fetch(`${apiUrl}/api/conversations/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: userMsg.slice(0, 30) + '...',
                        system_prompt: systemPrompt
                    })
                });
                const convData = await convRes.json();
                currentId = convData.id;
                // Use navigate with replace to prevent creating too many history entries
                navigate(`/c/${currentId}`, { replace: true });
            }

            const chatRes = await fetch(`${apiUrl}/api/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: parseInt(currentId as string),
                    models_to_use: selectedModels,
                    system_prompt: systemPrompt,
                    message: userMsg
                })
            });
            const chatData = await chatRes.json();
            setMessages(chatData);

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0f1115]">
            {/* Top Bar Config */}
            <div className="border-b border-[#2d3139] p-4 bg-[#16181d] flex flex-col gap-3 shrink-0 shadow-sm z-10 relative">
                <div className="flex items-center gap-4">
                    <Settings2 size={18} className="text-gray-400" />
                    <h2 className="text-sm font-medium">Model Configuration</h2>
                </div>

                <div className="flex flex-col gap-3 max-h-48 overflow-y-auto">
                    {allModels.length === 0 && <span className="text-xs text-red-400">No models available. Add them in Settings.</span>}
                    {providers.map(p => {
                        const pModels = allModels.filter(m => m.provider_id === p.id && m.enabled !== false);
                        if (pModels.length === 0) return null;
                        return (
                            <div key={p.id} className="flex flex-col gap-1.5">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{p.name}</div>
                                <div className="flex flex-wrap gap-2">
                                    {pModels.map(m => (
                                        <label key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-colors border ${selectedModels.includes(m.id) ? 'bg-blue-600/20 border-blue-500 text-blue-100' : 'bg-[#2d3139] border-transparent hover:border-gray-500 text-gray-300 hover:bg-[#3b414d]'}`}>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={selectedModels.includes(m.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedModels([...selectedModels, m.id]);
                                                    else setSelectedModels(selectedModels.filter(id => id !== m.id));
                                                }}
                                            />
                                            <span className="font-medium">{m.name || m.model_id}</span>
                                            {m.is_reasoning && <span title="Reasoning Model"><Cpu size={12} className={selectedModels.includes(m.id) ? 'text-purple-300' : 'text-purple-400'} /></span>}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* System Prompt Trigger */}
                <div className="flex flex-col gap-1 mt-2">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">System Prompt</span>
                    <button
                        onClick={() => setIsSystemPromptModalOpen(true)}
                        className="text-left text-sm bg-[#0f1115] text-gray-300 p-2 rounded focus:outline-none border border-[#2d3139] hover:border-blue-500 hover:text-white transition-colors truncate"
                    >
                        {systemPrompt.length > 80 ? systemPrompt.substring(0, 80) + '...' : systemPrompt}
                    </button>
                </div>
            </div>

            {/* System Prompt Modal Overlay */}
            {isSystemPromptModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#16181d] rounded-2xl w-full max-w-4xl border border-[#2d3139] shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-[#2d3139] flex justify-between items-center bg-[#1e2128] rounded-t-2xl">
                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                <Settings2 size={18} className="text-blue-400" />
                                Edit System Prompt
                            </h3>
                            <button
                                onClick={() => setIsSystemPromptModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <p className="text-sm text-gray-400 mb-4">
                                This prompt gives the models their persona and instructions. It applies to all messages in this conversation.
                            </p>
                            <textarea
                                className="w-full bg-[#0f1115] text-white p-4 rounded-xl resize-y focus:outline-none border border-[#2d3139] focus:border-blue-500 min-h-[300px] h-[50vh] transition-colors"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                            />
                        </div>
                        <div className="p-4 border-t border-[#2d3139] flex justify-end gap-3 bg-[#1e2128] rounded-b-2xl">
                            <button
                                onClick={() => setIsSystemPromptModalOpen(false)}
                                className="px-5 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <MessageEmptyState />
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={i} className={`flex max-w-4xl mx-auto mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-4 rounded-2xl relative ${editingMessageId === msg.id ? 'w-full max-w-3xl' : 'max-w-[85%]'} ${isUser ? 'bg-blue-600 text-white shadow-md' : 'bg-[#1e2128] text-gray-200 border border-[#2d3139]'}`}>
                                    {editingMessageId === msg.id ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                ref={el => {
                                                    if (el && !el.dataset.resized) {
                                                        el.style.height = 'auto';
                                                        el.style.height = el.scrollHeight + 'px';
                                                        el.dataset.resized = 'true';
                                                    }
                                                }}
                                                className="w-full bg-[#0f1115] text-white p-3 rounded resize-y focus:outline-none border border-blue-400 min-h-[120px] max-h-[75vh]"
                                                rows={5}
                                                value={editContent}
                                                onChange={e => {
                                                    setEditContent(e.target.value);
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                            />
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button onClick={() => setEditingMessageId(null)} className="text-xs text-gray-300 hover:text-white transition-colors">Cancel</button>
                                                <button onClick={() => submitEdit(msg.id)} disabled={isLoading} className="text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors">Save & Submit</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm prose prose-invert max-w-none whitespace-pre-wrap">{msg.content}</div>
                                    )}

                                    <div className="flex items-center gap-3 mt-3 pt-2 text-xs">
                                        {isUser ? (
                                            <>
                                                <span className="text-blue-200 opacity-70">You</span>
                                                {!editingMessageId && (
                                                    <div className="flex gap-3 ml-auto opacity-70">
                                                        <button onClick={() => handleCopy(msg.content)} className="text-blue-100 hover:text-white transition-colors flex items-center gap-1 cursor-pointer" title="Copy"><Copy size={12} /> Copy</button>
                                                        <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }} className="text-blue-100 hover:text-white transition-colors flex items-center gap-1 cursor-pointer" title="Edit"><Edit2 size={12} /> Edit</button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex w-full flex-col gap-2">
                                                {/* Generation Metadata */}
                                                {msg.generation_metadata && (
                                                    <div className="mt-1 flex flex-wrap gap-3 text-xs w-full">
                                                        {msg.generation_metadata.map((meta: any, mi: number) => {
                                                            const model = allModels.find(m => m.id === meta.model_id);
                                                            const provider = model ? providers.find(p => p.id === model.provider_id) : null;
                                                            return (
                                                                <div key={mi} className="bg-[#16181d] rounded px-2 py-1 flex items-center gap-3 border border-[#2d3139]">
                                                                    <span className="font-semibold text-blue-400">
                                                                        {provider ? `${provider.name} / ` : ''}{model?.name || 'Model'}
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-gray-400"><Clock size={10} /> {(meta.time_to_first_token || 0).toFixed(2)}s TTFT</span>
                                                                    <span className="flex items-center gap-1 text-gray-400"><Zap size={10} /> {(meta.tokens_per_second || 0).toFixed(1)} t/s</span>
                                                                    <span className="text-gray-400" title="Output Tokens">{meta.output_tokens} out tokens</span>
                                                                    {(meta.input_tokens !== null && meta.input_tokens !== undefined) && (
                                                                        <span className="text-gray-400" title="Input Tokens">
                                                                            {meta.input_tokens} in tokens
                                                                            {meta.cached_input_tokens ? ` (${meta.cached_input_tokens} cached)` : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3 mt-1 pt-2 border-t border-[#2d3139]/50 text-xs w-full">
                                                    <button onClick={() => handleCopy(msg.content)} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer" title="Copy"><Copy size={12} /> Copy</button>
                                                    <button onClick={() => handleRegenerate(msg.id)} disabled={isLoading} className="text-gray-400 hover:text-blue-400 disabled:opacity-50 transition-colors flex items-center gap-1 ml-auto cursor-pointer" title="Regenerate"><RotateCw size={12} /> Regenerate</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {isLoading && (
                    <div className="flex max-w-4xl mx-auto mb-6 justify-start">
                        <div className="p-4 rounded-2xl max-w-[85%] bg-[#1e2128] border border-[#2d3139] flex items-center gap-1 h-10 px-5">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#16181d] border-t border-[#2d3139] shrink-0">
                <div className="max-w-4xl mx-auto relative flex items-end bg-[#0f1115] border border-[#2d3139] rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 p-1 transition-all">
                    <textarea
                        className="w-full bg-transparent text-sm p-3 focus:outline-none resize-none max-h-48 text-gray-200"
                        rows={1}
                        placeholder="Type your message..."
                        value={input}
                        onChange={e => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button
                        disabled={isLoading || !input.trim() || selectedModels.length === 0}
                        onClick={handleSend}
                        className="p-3 m-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:bg-[#2d3139] disabled:text-gray-500 transition-colors flex items-center justify-center"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="max-w-4xl mx-auto mt-2 text-center text-xs text-gray-500">
                    Select at least one model before sending a message.
                </div>
            </div>
        </div>
    );
}

function MessageEmptyState() {
    return (
        <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                <Cpu size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">Start a new evaluation</h2>
            <p className="text-sm text-center max-w-sm">Select multiple models from the top panel, craft your system prompt, and see how different LLMs respond to the same query.</p>
        </>
    );
}
