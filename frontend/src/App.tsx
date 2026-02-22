import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router';
import { Settings, MessageSquare, Plus } from 'lucide-react';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';

function Sidebar() {
  const [conversations, setConversations] = useState<any[]>([]);
  const location = useLocation();

  useEffect(() => {
    const fetchConvs = () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      fetch(`${apiUrl}/api/conversations/`)
        .then(res => res.json())
        .then(data => setConversations(data))
        .catch(console.error);
    };

    fetchConvs();
    // Simple polling or event listener could go here if needed,
    // but fetching on mount/location change is a coarse workaround.
  }, [location.pathname]);

  return (
    <div className="w-64 bg-[#16181d] border-r border-[#2d3139] flex flex-col transition-all duration-300">
      <div className="p-4 flex items-center justify-between border-b border-[#2d3139]">
        <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">LLM Evaluator</h1>
      </div>

      <div className="p-3">
        <Link
          to="/"
          className="flex items-center gap-2 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm"
        >
          <Plus size={16} /> New Chat
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Recent</div>
        {conversations.length === 0 && (
          <div className="text-sm text-gray-500 italic px-2">No history</div>
        )}
        {conversations.map(c => (
          <Link key={c.id} to={`/c/${c.id}`} className={`flex items-center gap-2 p-2 hover:bg-[#2d3139] rounded cursor-pointer text-sm transition-colors ${location.pathname === `/c/${c.id}` ? 'bg-[#2d3139] text-white' : 'text-gray-300'}`}>
            <MessageSquare size={16} className={`${location.pathname === `/c/${c.id}` ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="truncate">{c.title}</span>
          </Link>
        ))}
      </div>

      <div className="p-3 border-t border-[#2d3139]">
        <Link to="/settings" className={`flex items-center gap-2 p-2 hover:bg-[#2d3139] rounded text-sm transition-colors ${location.pathname === '/settings' ? 'bg-[#2d3139] text-white' : 'text-gray-400 hover:text-white'}`}>
          <Settings size={18} />
          Providers & Models
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#0f1115] text-[#e2e8f0]">
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Routes>
            <Route path="/" element={<ChatView />} />
            <Route path="/c/:id" element={<ChatView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App;
