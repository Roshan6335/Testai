import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Sparkles, Copy, ThumbsUp, RefreshCw, Paperclip, Check, Plus, Search, X, FileIcon, ImageIcon, Mic, MicOff, Download, Trash2, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
}

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

export default function ChatInterface({ messages, isLoading, onSendMessage, onGenerateImage, onRegenerate, activeSessionId }: ChatInterfaceProps) {
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
      alert(`Invalid file type: "${file.name}"\n\nKeryo supports:\n• Images: JPG, PNG, WebP\n• Documents: PDF, Word (DOC/DOCX), Text (TXT)`);
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
    
    const content = input;
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
    setImagePrompt('');
    setIsGeneratingImage(false);
    await onGenerateImage(prompt, options);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 18) return "Afternoon";
    return "Evening";
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
                placeholder="How can I help you today?"
                rows={1}
                className="w-full bg-transparent px-4 py-3 pb-12 focus:outline-none resize-none text-lg max-h-48 overflow-y-auto placeholder:text-gray-400"
                style={{ height: 'auto', minHeight: '80px' }}
              />
              
              <div className="absolute left-4 bottom-4">
                 <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
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
                 {isSaving && <span className="text-[10px] text-gray-400 animate-pulse font-medium">Auto-saving...</span>}
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
                      onClick={() => setIsGeneratingImage(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
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
                        onClick={() => setIsGeneratingImage(false)}
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
              <Pill text="Code" icon={<RefreshCw className="w-3 h-3" />} onClick={() => setInput("How do I implement a debounced search in React?")} />
              <Pill text="Summarize" icon={<Copy className="w-3 h-3" />} onClick={() => setInput("Summarize this text for me...")} />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4">
          <div className="max-w-3xl mx-auto w-full space-y-4">
            {messages.map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                onRegenerate={onRegenerate}
              />
            ))}
            
            {isLoading && (
              <div className="px-4 py-6 flex gap-4">
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
                className="hidden"
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to Keryo..."
                rows={1}
                className="w-full bg-transparent px-4 py-3 pr-24 focus:outline-none resize-none text-[15px] max-h-48 overflow-y-auto placeholder:text-gray-400"
                style={{ height: 'auto', minHeight: '48px' }}
              />
              
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
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
                <button 
                  type="button"
                  onClick={() => setShowingFiles(true)}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  title="Manage session files"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl transition-all ${attachedFile ? 'text-black bg-gray-100' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
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
                      onClick={() => setIsGeneratingImage(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
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
                        onClick={() => setIsGeneratingImage(false)}
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

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-2 flex gap-4"
    >
      <div className={`w-8 h-8 mt-1 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 ${isModel ? 'bg-gray-50' : 'bg-gray-100'}`}>
        {isModel ? <KeryoLogo className="w-5 h-5 text-gray-900" /> : <User className="w-4 h-4 text-gray-500" />}
      </div>
      
      <div className="flex-1 min-w-0 group">
        <div className={`p-4 rounded-2xl transition-all duration-300 ${isModel ? 'text-gray-800 hover:bg-gray-50/50' : 'text-gray-900 hover:bg-gray-50/30'}`}>
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
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
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
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {isModel && (
            <div className="flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
              <ActionButton 
                icon={copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />} 
                onClick={handleCopy}
                label={copied ? "Copied" : "Copy"}
              />
              <ActionButton 
                icon={<ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'text-indigo-600 fill-indigo-50' : ''}`} />} 
                onClick={() => setLiked(!liked)}
                label="Like"
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

function StarterButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-3 bg-white border border-gray-100 rounded-xl text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-black hover:shadow-sm transition-all text-left flex items-center justify-between group active:scale-[0.98]"
    >
      {text}
      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
    </button>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
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
