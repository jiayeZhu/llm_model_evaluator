import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Send, Settings2, Cpu, Clock, Zap } from 'lucide-react';

export default function ChatView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
    const [selectedModels, setSelectedModels] = useState<number[]>([]);
    const [allModels, setAllModels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Fetch models on mount
    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        fetch(`${apiUrl}/api/models/`)
            .then(res => res.json())
            .then(data => setAllModels(data || []))
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

                <div className="flex flex-wrap gap-2">
                    {allModels.length === 0 && <span className="text-xs text-red-400">No models available. Add them in Settings.</span>}
                    {allModels.map(m => (
                        <label key={m.id} className="flex items-center gap-2 bg-[#2d3139] px-3 py-1.5 rounded-full text-xs cursor-pointer hover:bg-[#3b414d] transition-colors border border-transparent hover:border-gray-500">
                            <input
                                type="checkbox"
                                className="accent-blue-500 rounded bg-[#16181d] border-gray-600 w-3 h-3"
                                checked={selectedModels.includes(m.id)}
                                onChange={(e) => {
                                    if (e.target.checked) setSelectedModels([...selectedModels, m.id]);
                                    else setSelectedModels(selectedModels.filter(id => id !== m.id));
                                }}
                            />
                            <span className="font-medium">{m.name || m.model_id}</span>
                            {m.is_reasoning && <span title="Reasoning Model"><Cpu size={12} className="text-purple-400 ml-1" /></span>}
                        </label>
                    ))}
                </div>

                <div className="mt-2">
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">System Prompt</label>
                    <textarea
                        className="w-full bg-[#0f1115] border border-[#2d3139] rounded p-2 text-sm focus:outline-none focus:border-blue-500 text-gray-300 resize-none"
                        rows={2}
                        value={systemPrompt}
                        onChange={e => setSystemPrompt(e.target.value)}
                    />
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <MessageEmptyState />
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i} className={`flex max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-4 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-md' : 'bg-[#1e2128] text-gray-200 border border-[#2d3139]'}`}>
                                <div className="text-sm prose prose-invert max-w-none">{msg.content}</div>
                                {/* Generation Metadata */}
                                {msg.role === 'assistant' && msg.generation_metadata && (
                                    <div className="mt-3 pt-3 flex flex-wrap gap-3 border-t border-[#2d3139]/50 text-xs">
                                        {msg.generation_metadata.map((meta: any, mi: number) => {
                                            const model = allModels.find(m => m.id === meta.model_id);
                                            return (
                                                <div key={mi} className="bg-[#16181d] rounded px-2 py-1 flex items-center gap-3 border border-[#2d3139]">
                                                    <span className="font-semibold text-blue-400">{model?.name || 'Model'}</span>
                                                    <span className="flex items-center gap-1 text-gray-400"><Clock size={10} /> {(meta.time_to_first_token || 0).toFixed(2)}s TTFT</span>
                                                    <span className="flex items-center gap-1 text-gray-400"><Zap size={10} /> {(meta.tokens_per_second || 0).toFixed(1)} t/s</span>
                                                    <span className="text-gray-400">{meta.output_tokens} out tokens</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
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
