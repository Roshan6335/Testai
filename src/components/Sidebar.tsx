import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Settings, 
  LogOut, 
  History,
  CreditCard,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Trash2,
  X,
  Check,
  MessageCircle
} from 'lucide-react';
import KeryoLogo from './KeryoLogo';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  user: any;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
  onToggleSettings: () => void;
  onLogout: () => void;
}

export default function Sidebar({ 
  sessions, 
  activeSessionId, 
  user, 
  onNewChat, 
  onSelectChat, 
  onUpdateTitle,
  onDeleteChat,
  onToggleSettings, 
  onLogout 
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter(session => 
    session.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden shrink-0"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight px-1">Keryo</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-black"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="px-3 pb-2 space-y-1">
              <button 
                onClick={onNewChat}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 rounded-lg text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Navigation Lists */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              <div>
                <div className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Chats</div>
                <div className="space-y-0.5">
                  {filteredSessions.map((session) => (
                    <SessionItem 
                      key={session.id}
                      session={session}
                      isActive={activeSessionId === session.id}
                      onSelect={() => onSelectChat(session.id)}
                      onUpdateTitle={(title) => onUpdateTitle(session.id, title)}
                      onDelete={() => onDeleteChat(session.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* User Section */}
            <div className="p-3 mt-auto border-t border-gray-100 space-y-0.5">
              <button 
                onClick={() => window.open('mailto:feedback@keryo.ai?subject=Keryo Feedback')}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                title="Send Feedback"
              >
                <MessageCircle className="w-4 h-4" />
                Send Feedback
              </button>
              
              <button 
                onClick={onToggleSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-red-50 hover:text-red-500 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>

              <div className="mt-2 pt-2 border-t border-gray-50 px-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-500">
                  {user?.displayName?.slice(0, 1) || user?.email?.slice(0, 1) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-20 p-2 bg-white border border-gray-100 shadow-sm rounded-lg hover:border-gray-300 transition-all"
        >
          <PanelLeftOpen className="w-4 h-4 text-gray-400 hover:text-black" />
        </button>
      )}
    </>
  );
}

function SessionItem({ 
  session, 
  isActive, 
  onSelect, 
  onUpdateTitle,
  onDelete
}: { 
  session: ChatSession; 
  isActive: boolean; 
  onSelect: () => void; 
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [title, setTitle] = useState(session.title);

  const handleSubmit = () => {
    if (title.trim() && title !== session.title) {
      onUpdateTitle(title);
    } else {
      setTitle(session.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setTitle(session.title);
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) {
      onDelete();
      setIsDeleting(false);
    } else {
      setIsDeleting(true);
    }
  };

  if (isEditing) {
    return (
      <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 rounded-lg">
        <input 
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-none outline-none text-sm font-medium"
        />
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        onDoubleClick={() => setIsEditing(true)}
        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all text-left ${
          isActive 
            ? 'bg-gray-100 text-black font-medium' 
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <span className="truncate flex-1">{session.title || 'Untitled Chat'}</span>
        {session.title === 'New Chat' && (
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        )}
      </button>

      <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity ${isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {isDeleting ? (
          <div className="flex items-center gap-0.5 bg-white border border-gray-100 rounded-md shadow-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <button 
              onClick={handleDelete}
              className="p-1.5 text-red-500 hover:bg-red-50 transition-colors"
              title="Confirm Delete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }}
              className="p-1.5 text-gray-400 hover:bg-gray-50 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-md transition-colors"
            title="Delete Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
