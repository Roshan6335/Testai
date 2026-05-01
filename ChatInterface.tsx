import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Paperclip, Check, Plus, Search, X, FileIcon, Code2, Mic, MicOff, Download, Trash2, FolderOpen, FileDown, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import KeryoLogo from './KeryoLogo';
import { auth } from '../lib/firebase';
import { compressImage, base64ToFile } from '../lib/imageUtils';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: any;
  attachments?: {
    url: string;
    name: string;
    type: string;
    size?: number;
  }[];
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string, attachment?: File | null) => Promise<void>;
  onGenerateImage: (prompt: string, options?: { aspectRatio?: string, style?: string }) => Promise<void>;
  onRegenerate?: () => void;
  activeSessionId: string | null;
  activePersona: string;
  setActivePersona: (persona: string) => void;
}

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'text/plain'
];

const FILE_INPUT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,text/plain';

export default function ChatInterface({ messages, isLoading, onSendMessage, onGenerateImage, onRegenerate, activeSessionId, activePersona, setActivePersona }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [showingFiles, setShowingFiles] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageOptions, setImageOptions] = useState({ aspectRatio: '1:1', style: 'photorealistic' });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert(`Invalid file type: "${file.name}"\n\nKeryo supports:\n• Images: JPG, PNG, WebP\n• Documents: PDF, Text (TXT)\n\nNote: GIF and Word files are not supported.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let finalFile = file;
    
    if (file.type.startsWith('image/')) {
      if (file.size > 1024 * 1024) { // > 1MB
        setIsCompressing(true);
        setCompressionProgress(0);
        
        // Progress simulation for compression
        const interval = setInterval(() => {
          setCompressionProgress(prev => {
            if (prev >= 95) {
              clearInterval(interval);
              return 95;
            }
            return prev + (Math.random() * 15);
          });
        }, 150);

        try {
          const result = await compressImage(file);
          clearInterval(interval);
          setCompressionProgress(100);
          finalFile = base64ToFile(result.url, file.name);
          setFilePreview(result.url);
        } catch (error) {
          clearInterval(interval);
          console.error("Compression failed:", error);
          setFilePreview(URL.createObjectURL(file));
        } finally {
          setTimeout(() => {
            setIsCompressing(false);
            setCompressionProgress(0);
          }, 400);
        }
      } else {
        setFilePreview(URL.createObjectURL(file));
      }
    } else {
      setFilePreview(null);
    }
    
    setAttachedFile(finalFile);
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Restore draft on mount or session change
  useEffect(() => {
    // Stop speech recognition when switching sessions
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const draftKey = `keryo_draft_${activeSessionId || 'new'}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      setInput(savedDraft);
    } else {
      setInput('');
    }
  }, [activeSessionId]);

  // Save draft on input change
  useEffect(() => {
    const draftKey = `keryo_draft_${activeSessionId || 'new'}`;
    if (input.trim()) {
      localStorage.setItem(draftKey, input);
      setIsSaving(true);
      const timer = setTimeout(() => setIsSaving(false), 1000);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [input, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading) return;
    
    let content = input;
    if (isWebSearchEnabled) {
      content = `[KERYO_WEB_SEARCH] ` + content;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 5, 90));
    }, 100);

    try {
      await onSendMessage(content, attachedFile);
      clearInterval(interval);
      setUploadProgress(100);
      
      const draftKey = `keryo_draft_${activeSessionId || 'new'}`;
      localStorage.removeItem(draftKey);
      setInput('');
      setIsWebSearchEnabled(false);
      removeFile();
    } catch (error) {
      clearInterval(interval);
      console.error("Failed to send message, keeping input:", error);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleGenerateImageSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!imagePrompt.trim() || isLoading) return;
    const prompt = imagePrompt;
    const options = imageOptions;
    // Keep modal open during generation — close after completion
    await onGenerateImage(prompt, options);
    // Reset state after generation completes
    setImagePrompt('');
    setImageOptions({ aspectRatio: '1:1', style: 'photorealistic' });
    setIsGeneratingImage(false);
  };

  // Reset image options when modal closes
  const closeImageModal = () => {
    setIsGeneratingImage(false);
    setImagePrompt('');
    setImageOptions({ aspectRatio: '1:1', style: 'photorealistic' });
  };

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keryo_chat_export_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || "there";

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Empty State / Welcome Screen */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto w-full lg:mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
             <h1 className="text-5xl font-serif text-[#1d1d1b] tracking-tight mb-2">
               {getTimeGreeting()}, {displayName}
             </h1>
          </motion.div>
          
          <div className="w-full relative group">
            <form 
              onSubmit={handleSubmit}
              className="relative bg-white border border-gray-200 focus-within:border-gray-400 rounded-2xl transition-all shadow-sm focus-within:shadow-md p-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                placeholder="How can I help you today?"
                rows={1}
                className="w-full bg-transparent px-4 py-3 pb-12 focus:outline-none resize-none text-lg max-h-48 overflow-y-auto placeholder:text-gray-400"
                style={{ minHeight: '80px' }}
              />
              
              <div className="absolute left-4 bottom-4">
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Attach file">
                   <Plus className="w-5 h-5" />
                 </button>
              </div>

              <div className="absolute right-4 bottom-4 flex items-center gap-3">
                 <button 
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 transition-all rounded-xl ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  title={isListening ? "Stop listening" : "Voice input"}
                 >
                   {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                 </button>
                 <button 
                  type="button"
                  onClick={() => setIsGeneratingImage(true)}
                  className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
                  title="Generate Image"
                 >
                  <Sparkles className="w-4 h-4" />
                 </button>
                 {isSaving && <span className="text-[10px] text-gray-400 font-medium">Draft saved</span>}
                 <span className="text-xs text-gray-400 font-medium hidden sm:inline">Keryo 1.0</span>
                 <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`p-2 rounded-xl transition-all transform active:scale-95 ${
                    input.trim() && !isLoading 
                      ? 'bg-black text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {isUploading && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-100 overflow-hidden rounded-b-2xl">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-black"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              )}
            </form>
            <div className="mt-4 text-center">
              <p className="text-[10px] text-gray-400 font-medium">Keryo can make mistakes. Check important info.</p>
              <div className="mt-8 flex flex-col items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Made by Roshan</p>
                <div className="w-4 h-[1px] bg-gray-200"></div>
              </div>
            </div>

            {/* Image Generation Overlay */}
            <AnimatePresence>
              {isGeneratingImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-3 shadow-xl border border-gray-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Create an image
                    </div>
                    <button 
                      onClick={closeImageModal}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                      aria-label="Close image generator"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleGenerateImageSubmit} className="flex-1 flex flex-col gap-4">
                    <textarea 
                      autoFocus
                      placeholder="Describe the image you want to generate..."
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] placeholder:text-gray-400"
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Aspect Ratio</label>
                        <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                          {['1:1', '16:9', '9:16', '3:4', '4:3'].map(ratio => (
                            <button
                              key={ratio}
                              type="button"
                              onClick={() => setImageOptions(prev => ({ ...prev, aspectRatio: ratio }))}
                              className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all ${imageOptions.aspectRatio === ratio ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Style</label>
                        <select 
                          value={imageOptions.style}
                          onChange={(e) => setImageOptions(prev => ({ ...prev, style: e.target.value }))}
                          className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:ring-0 focus:outline-none cursor-pointer"
                        >
                          <option value="photorealistic">Photorealistic</option>
                          <option value="artistic">Artistic</option>
                          <option value="sketch">Sketch</option>
                          <option value="cyberpunk">Cyberpunk</option>
                          <option value="minimalist">Minimalist</option>
                          <option value="isometric">Isometric</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                       <button 
                        type="button"
                        onClick={closeImageModal}
                        className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-black transition-colors"
                       >
                        Cancel
                       </button>
                       <button 
                        type="submit"
                        disabled={!imagePrompt.trim() || isLoading}
                        className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-indigo-200"
                       >
                        Generate Image
                       </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Pill text="Write" icon={<Sparkles className="w-3 h-3" />} onClick={() => setInput("Write a professional email about...")} />
              <Pill text="Learn" icon={<Search className="w-3 h-3" />} onClick={() => setInput("Explain the concept of quantum computing like I'm 5")} />
              <Pill text="Code" icon={<Code2 className="w-3 h-3" />} onClick={() => setInput("How do I implement a debounced search in React?")} />
              <Pill text="Summarize" icon={<Copy className="w-3 h-3" />} onClick={() => setInput("Summarize this text for me...")} />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4 relative">
          
          {/* Top Bar: Model Selector & Actions */}
          <div className="absolute top-4 inset-x-0 flex justify-center z-10 pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-700">Keryo 1.0</span>
              </div>
              <select 
                value={activePersona}
                onChange={(e) => setActivePersona(e.target.value)}
                className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm outline-none cursor-pointer hover:bg-gray-50 transition-colors appearance-none pr-8 relative"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="default">Default AI</option>
                <option value="coder">Code Expert</option>
                <option value="marketing">Marketing Guru</option>
                <option value="therapist">Empathetic Listener</option>
              </select>
            </div>
          </div>
          
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleExportConversation}
              className="px-3 py-1.5 flex items-center gap-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-900 transition-all shadow-sm"
              title="Export Conversation"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
          <div className="max-w-3xl mx-auto w-full space-y-4 mt-8">
            {messages.map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                onRegenerate={onRegenerate}
              />
            ))}
            
            {isLoading && (
              <div className="px-4 py-6 flex gap-4" role="status" aria-label="Keryo is thinking">
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <KeryoLogo className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-1.5 p-3 px-4 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm">
                  <motion.span 
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                    className="w-1.5 h-1.5 bg-black rounded-full"
                  ></motion.span>
                  <motion.span 
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-black rounded-full"
                  ></motion.span>
                  <motion.span 
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-black rounded-full"
                  ></motion.span>
                  <span className="sr-only">Keryo is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area (Sticky bottom when chatting) */}
      {messages.length > 0 && (
        <div className="p-4 bg-white/80 backdrop-blur-md">
          <div className="max-w-3xl mx-auto relative group">
            {/* File Preview */}
            <AnimatePresence>
              {attachedFile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3 relative shadow-sm"
                >
                  <div className="w-14 h-14 bg-white rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <FileIcon className="w-6 h-6 text-gray-400" />
                    )}
                    {isCompressing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-2">
                        <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden mb-1">
                          <motion.div 
                            className="absolute inset-y-0 left-0 bg-indigo-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${compressionProgress}%` }}
                          />
                        </div>
                        <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Optimizing</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-semibold text-gray-900 truncate">{attachedFile.name}</p>
                       {isCompressing && <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider animate-pulse">Compressing...</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono uppercase">
                      {(attachedFile.size / 1024).toFixed(1)} KB • {attachedFile.type || 'unknown'}
                    </p>
                  </div>
                  <button 
                    onClick={removeFile}
                    className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-400 hover:text-red-500 hover:shadow-sm"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form 
              onSubmit={handleSubmit}
              className="relative bg-white border border-gray-200 focus-within:border-gray-400 rounded-2xl transition-all shadow-sm focus-within:shadow-md p-1"
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={FILE_INPUT_ACCEPT}
                className="hidden"
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                placeholder="Reply to Keryo..."
                rows={1}
                className="w-full bg-transparent px-4 py-3 pr-24 focus:outline-none resize-none text-[15px] max-h-48 overflow-y-auto placeholder:text-gray-400"
                style={{ minHeight: '48px' }}
              />
              
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 transition-all rounded-xl ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  title={isListening ? "Stop listening" : "Voice input"}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                  className={`p-2 transition-all rounded-xl ${isWebSearchEnabled ? 'text-blue-500 bg-blue-50 shadow-sm border border-blue-100' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  title="Search Web"
                  aria-label="Search Web"
                >
                  <Globe className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={() => setIsGeneratingImage(true)}
                  className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
                  title="Generate Image"
                  aria-label="Generate image"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={() => setShowingFiles(true)}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  title="Manage session files"
                  aria-label="Manage session files"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl transition-all ${attachedFile ? 'text-black bg-gray-100' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button 
                  type="submit"
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  className={`p-2 rounded-xl transition-all transform active:scale-95 ${
                    (input.trim() || attachedFile) && !isLoading 
                      ? 'bg-black text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {isUploading && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-100 overflow-hidden rounded-b-2xl">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-black"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              )}
            </form>
            <div className="mt-2 text-center pb-2">
              <p className="text-[10px] text-gray-400 font-medium tracking-tight">Keryo can make mistakes. Check important info.</p>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 mt-4">Made by Roshan</p>
            </div>

            {/* Image Generation Overlay */}
            <AnimatePresence>
              {isGeneratingImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-3 shadow-xl border border-gray-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Create an image
                    </div>
                    <button 
                      onClick={closeImageModal}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                      aria-label="Close image generator"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleGenerateImageSubmit} className="flex-1 flex flex-col gap-4">
                    <textarea 
                      autoFocus
                      placeholder="Describe the image you want to generate..."
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] placeholder:text-gray-400"
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Aspect Ratio</label>
                        <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                          {['1:1', '16:9', '9:16', '3:4', '4:3'].map(ratio => (
                            <button
                              key={ratio}
                              type="button"
                              onClick={() => setImageOptions(prev => ({ ...prev, aspectRatio: ratio }))}
                              className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all ${imageOptions.aspectRatio === ratio ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Style</label>
                        <select 
                          value={imageOptions.style}
                          onChange={(e) => setImageOptions(prev => ({ ...prev, style: e.target.value }))}
                          className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:ring-0 focus:outline-none cursor-pointer"
                        >
                          <option value="photorealistic">Photorealistic</option>
                          <option value="artistic">Artistic</option>
                          <option value="sketch">Sketch</option>
                          <option value="cyberpunk">Cyberpunk</option>
                          <option value="minimalist">Minimalist</option>
                          <option value="isometric">Isometric</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                       <button 
                        type="button"
                        onClick={closeImageModal}
                        className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-black transition-colors"
                       >
                        Cancel
                       </button>
                       <button 
                        type="submit"
                        disabled={!imagePrompt.trim() || isLoading}
                        className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-indigo-200"
                       >
                        Generate Image
                       </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* File Management Modal */}
      <AnimatePresence>
        {showingFiles && (
          <FileManagementModal 
            messages={messages} 
            onClose={() => setShowingFiles(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Pill({ text, icon, onClick }: { text: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-900 transition-all shadow-sm"
    >
      {icon}
      {text}
    </button>
  );
}

function MessageItem({ message, onRegenerate }: { message: Message, onRegenerate?: () => void }) {
  const isModel = message.role === 'model';
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-2 py-2 flex gap-4 w-full"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isModel ? 'bg-transparent border border-gray-200' : 'bg-gray-100 border border-gray-200/50'}`}>
        {isModel ? <Sparkles className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-gray-500" />}
      </div>
      
      <div className="flex-1 min-w-0 group pt-1">
        <div className={`text-gray-800 transition-all duration-300`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-4 space-y-2">
              {message.attachments.map((file, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border border-gray-100 max-w-sm">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-auto object-cover max-h-[300px]" />
                  ) : (
                    <div className="p-3 flex items-center gap-2 bg-gray-50">
                      <FileIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-xs truncate">{file.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  // v10 fix: detect block code by presence of language class
                  if (match) {
                    return (
                      <div className="relative group/code">
                        <button
                          onClick={() => { navigator.clipboard.writeText(codeString); }}
                          className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-md opacity-0 group-hover/code:opacity-100 transition-all text-[10px] font-medium flex items-center gap-1"
                          aria-label="Copy code"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <SyntaxHighlighter
                          {...props}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-xl my-4 text-sm"
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            borderRadius: '0.75rem',
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  // Inline code
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {DOMPurify.sanitize(message.content)}
            </ReactMarkdown>
          </div>
          
          {/* Timestamp */}
          {message.createdAt && (
            <div className="mt-2 text-[10px] text-gray-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(message.createdAt)}
            </div>
          )}
          
          {isModel && (
            <div className="flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
              <ActionButton 
                icon={copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />} 
                onClick={handleCopy}
                label={copied ? "Copied" : "Copy"}
              />
              <ActionButton 
                icon={<ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'text-indigo-600 fill-indigo-100' : ''}`} />} 
                onClick={() => { setLiked(!liked); setDisliked(false); }}
                label="Like"
              />
              <ActionButton 
                icon={<ThumbsDown className={`w-3.5 h-3.5 ${disliked ? 'text-red-500 fill-red-100' : ''}`} />} 
                onClick={() => { setDisliked(!disliked); setLiked(false); }}
                label="Dislike"
              />
              <ActionButton 
                icon={<RefreshCw className="w-3.5 h-3.5" />} 
                onClick={onRegenerate}
                label="Regenerate"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon, onClick, label }: { icon: React.ReactNode; onClick?: () => void; label: string }) {
  return (
    <div className="relative group/btn">
      <button 
        onClick={onClick}
        className="text-gray-400 hover:text-black hover:bg-white border border-transparent hover:border-gray-100 p-2 rounded-lg transition-all"
      >
        {icon}
      </button>
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </div>
  );
}


function FileManagementModal({ messages, onClose }: { messages: Message[], onClose: () => void }) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  
  // Extract all unique attachments from messages
  const allFiles = messages.reduce((acc, msg) => {
    if (msg.attachments) {
      msg.attachments.forEach(file => {
        if (!acc.find(f => f.url === file.url)) {
          acc.push(file);
        }
      });
    }
    return acc;
  }, [] as any[]);

  const toggleSelect = (url: string) => {
    setSelectedUrls(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUrls.length === allFiles.length) {
      setSelectedUrls([]);
    } else {
      setSelectedUrls(allFiles.map(f => f.url));
    }
  };

  const batchDownload = () => {
    const selectedFiles = allFiles.filter(f => selectedUrls.includes(f.url));
    selectedFiles.forEach(file => {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const batchDelete = () => {
    alert("Batch delete feature: Files would be removed from the view in this simulation. In a real app, this would delete session metadata.");
    setSelectedUrls([]);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <FolderOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Vault</h3>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                {allFiles.length} item{allFiles.length !== 1 ? 's' : ''} in session
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-black active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {allFiles.length > 0 && (
          <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <button 
              onClick={toggleSelectAll}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {selectedUrls.length === allFiles.length ? 'Deselect All' : `Select All (${allFiles.length})`}
            </button>
            <AnimatePresence>
              {selectedUrls.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-[10px] font-bold text-gray-400 mr-2">{selectedUrls.length} selected</span>
                  <button 
                    onClick={batchDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                  <button 
                    onClick={batchDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-xl text-[10px] font-bold text-red-600 hover:bg-red-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {allFiles.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-gray-400 gap-4">
              <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-gray-200">
                <FileIcon className="w-10 h-10 opacity-30" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-gray-900">No treasures found</p>
                <p className="text-xs text-gray-500 font-medium tracking-wide">Attach files to see them listed in your session vault.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allFiles.map((file, idx) => {
                const isSelected = selectedUrls.includes(file.url);
                return (
                  <motion.div 
                    key={idx}
                    layout
                    onClick={() => toggleSelect(file.url)}
                    className={`group relative p-4 rounded-3xl border-2 transition-all cursor-pointer select-none ${
                      isSelected 
                        ? 'bg-indigo-50/30 border-indigo-200 shadow-lg' 
                        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-xl'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <FileIcon className="w-8 h-8 text-indigo-300" />
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center">
                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg scale-110">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black truncate tracking-tight transition-colors ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                            {file.type.split('/')[1] || 'FILE'}
                          </span>
                          <p className="text-[10px] text-gray-400 font-bold">
                            {file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'Size ?'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {!isSelected && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border-2 border-gray-200 bg-white" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-8 bg-white border-t border-gray-100 flex items-center justify-between">
          <div className="hidden sm:block">
            {selectedUrls.length > 0 && (
              <p className="text-xs font-bold text-gray-400">
                You've selected <span className="text-indigo-600">{selectedUrls.length} items</span> from your vault
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-10 py-3 bg-black text-white text-sm font-black rounded-2xl active:scale-95 transition-all shadow-xl hover:shadow-gray-200 flex items-center justify-center gap-2"
          >
            Close Vault
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
