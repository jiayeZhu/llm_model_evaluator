import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router';
import { Settings, MessageSquare, Plus, Trash2 } from 'lucide-react';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';

function Sidebar() {
  const [conversations, setConversations] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(conversations.filter(c => c.id !== id));
        if (location.pathname === `/c/${id}`) {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

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
          <Link key={c.id} to={`/c/${c.id}`} className={`group flex items-center justify-between p-2 hover:bg-[#2d3139] rounded cursor-pointer text-sm transition-colors ${location.pathname === `/c/${c.id}` ? 'bg-[#2d3139] text-white' : 'text-gray-300'}`}>
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <MessageSquare size={16} className={`flex-shrink-0 ${location.pathname === `/c/${c.id}` ? 'text-blue-400' : 'text-gray-500'}`} />
              <span className="truncate">{c.title}</span>
            </div>
            <button
              onClick={(e) => handleDelete(e, c.id)}
              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              title="Delete Conversation"
            >
              <Trash2 size={14} />
            </button>
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
