import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser,
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { getChatResponse, generateImage, generateTitle, ChatMessage } from './lib/gemini';
import { compressImage, fileToBase64 } from './lib/imageUtils';
import { encryptData, decryptData } from './lib/encryption';
import { extractTextFromPDF } from './lib/pdfUtils';
import { performWebSearch } from './lib/webSearch';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import RazorpayButton from './components/RazorpayButton';
import KeryoLogo from './components/KeryoLogo';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, User as UserIcon, Shield, Bell, Check } from 'lucide-react';

// Error Boundary component to prevent white-screen crashes
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all">Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApp, setShowApp] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [activePersona, setActivePersona] = useState('default');

  useEffect(() => {
    // Health check
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsOnline(true);
      } catch (error: any) {
  if (error.code === 'not-found' || error.message?.includes('not found')) {
    console.error('Firestore DB not found — check VITE_FIREBASE_DATABASE_ID env var:', error.message);
    setIsOnline(true); // config error, not a network error — don't show the banner
  } else if (error.code === 'permission-denied') {
    setIsOnline(true); // connected fine, rules just block the test doc — expected
  } else if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
    console.warn('Firestore offline.');
    setIsOnline(false);
  } else {
    console.error('Firestore test failed:', error.code, error.message);
    setIsOnline(true);
  }
}
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDocFromServer(userRef).catch(() => getDoc(userRef));
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              createdAt: serverTimestamp(),
              subscription: { plan: 'free', status: 'active' }
            });
          }
        } catch (e) {
          console.error("User doc error:", e);
        }
        setUser(currentUser);
        setShowApp(true);
      } else {
        setUser(null);
        setShowApp(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Chat Sessions
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'chats'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatSessions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          title: data.title ? decryptData(data.title) : data.title
        };
      });
      setSessions(chatSessions as any);
    }, (error) => {
      console.error("Session fetch error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Messages for active session
  useEffect(() => {
    if (!user || !activeSessionId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'chats', activeSessionId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          content: data.content ? decryptData(data.content) : data.content
        };
      });
      setMessages(chatMessages as any);
    }, (error) => {
      console.error("Message fetch error:", error);
    });

    return () => unsubscribe();
  }, [user, activeSessionId]);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      // Ignore common user-cancelled errors
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      console.error("Login failed:", error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowApp(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
        title: encryptData(newTitle),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${sessionId}`);
    }
  };

  const handleGenerateImage = async (prompt: string, options?: { aspectRatio?: string, style?: string }) => {
    if (!user) return;
    
    let sessionId = activeSessionId;
    setIsChatLoading(true);

    try {
      // 1. Create session if none exists
      if (!sessionId) {
        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          userId: user.uid,
          title: encryptData(`Image: ${prompt.slice(0, 20)}...`),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        sessionId = chatRef.id;
        setActiveSessionId(sessionId);
      } else {
        // Update title if it was "New Chat"
        const currentSession = sessions.find(s => s.id === sessionId);
        if (currentSession?.title === 'New Chat') {
          await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
            title: encryptData(`Image: ${prompt.slice(0, 20)}...`),
            updatedAt: serverTimestamp()
          });
        }
      }

      // 2. Add user message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'user',
        content: encryptData(`Generate image: ${prompt}${options?.style ? ` (Style: ${options.style})` : ''}${options?.aspectRatio ? ` (Ratio: ${options.aspectRatio})` : ''}`),
        createdAt: serverTimestamp()
      });

      // 3. Generate image
      const imageAsset = await generateImage(prompt, options);
      
      // 4. Compress if too large for Firestore (Limit is 1MB, let's aim for < 800KB)
      let firestoreAsset = { ...imageAsset };
      if (imageAsset.size && imageAsset.size > 800000) {
        console.log(`Compressing image: ${Math.round(imageAsset.size / 1024)}KB`);
        const result = await compressImage(imageAsset.url);
        firestoreAsset.url = result.url;
        firestoreAsset.size = result.size;
        console.log(`Compressed to: ${Math.round(firestoreAsset.size / 1024)}KB`);
      }

      // 5. Add model message with image
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'model',
        content: encryptData(`Here is the image I generated for: "${prompt}"`),
        attachments: [firestoreAsset],
        createdAt: serverTimestamp()
      });

      // 6. Update session timestamp
      await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
        updatedAt: serverTimestamp()
      });

    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${sessionId || 'new'}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    try {
      // 1. Delete all messages in the subcollection (prevents orphaned data & storage costs)
      const messagesRef = collection(db, 'users', user.uid, 'chats', sessionId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      if (messagesSnap.size > 0) {
        const batch = writeBatch(db);
        messagesSnap.docs.forEach(msgDoc => batch.delete(msgDoc.ref));
        await batch.commit();
      }
      
      // 2. Delete the chat document
      await deleteDoc(doc(db, 'users', user.uid, 'chats', sessionId));
      
      // 3. Clean up localStorage draft for this session
      localStorage.removeItem(`keryo_draft_${sessionId}`);
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chats/${sessionId}`);
    }
  };

  const handleNewChat = async () => {
    if (!user || isCreatingChat) return;
    setIsCreatingChat(true);
    try {
      const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
        userId: user.uid,
        title: encryptData('New Chat'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveSessionId(chatRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats`);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSendMessage = async (content: string, attachment?: File | null) => {
    if (!user) return;

    let sessionId = activeSessionId;
    let attachments: any[] = [];

    if (attachment) {
      if (attachment.size > 800 * 1024) { // Warning if > 800KB
        console.warn("Large attachment detected. Firestore document limit is 1MB.");
      }

      // For local display and persistence (limited to 1MB total doc size)
      let firestoreUrl = "";
      
      // Handle PDF uploads securely in browser
      if (attachment.type === 'application/pdf') {
        try {
          const pdfText = await extractTextFromPDF(attachment);
          content += `\n\n[ATTACHED DOCUMENT: ${attachment.name}]\n${pdfText.slice(0, 50000)}`; // limit PDF to 50k chars to prevent token overflow
        } catch (e) {
          console.warn("Failed to extract PDF text", e);
          content += `\n\n[Could not read PDF: ${attachment.name}]`;
        }
      } else {
        // Handle Images
        if (attachment.type.startsWith('image/')) {
          try {
            const compressed = await compressImage(attachment, 1200, 0.6); // More aggressive compression for safety
            firestoreUrl = compressed.url;
          } catch (e) {
            console.warn("Compression failed, using original", e);
            firestoreUrl = await fileToBase64(attachment);
          }
        } else {
          firestoreUrl = await fileToBase64(attachment);
        }

        if (firestoreUrl.length > 900000) { // Still too big for Firestore (approx)
          alert("This file is too large to be processed. Please try a smaller file (under 700KB).");
          return;
        }

        attachments = [{
          url: firestoreUrl, 
          name: attachment.name,
          type: attachment.type,
          size: attachment.size
        }];
      }
    }

    let isWebSearch = false;
    let actualPrompt = content;
    if (content.startsWith('[KERYO_WEB_SEARCH] ')) {
      isWebSearch = true;
      actualPrompt = content.replace('[KERYO_WEB_SEARCH] ', '');
    }

    try {
      // Create session if none exists
      if (!sessionId) {
        const rawTitle = content ? (content.slice(0, 30) + (content.length > 30 ? '...' : '')) : (attachment ? `File: ${attachment.name}` : 'New Chat');
        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          userId: user.uid,
          title: encryptData(rawTitle),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        sessionId = chatRef.id;
        setActiveSessionId(sessionId);
      } else {
        // Update title if it was "New Chat"
        const currentSession = sessions.find(s => s.id === sessionId);
        if (currentSession?.title === 'New Chat') {
          const rawTitle = content ? (content.slice(0, 30) + (content.length > 30 ? '...' : '')) : (attachment ? `File: ${attachment.name}` : 'New Chat');
          await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
            title: encryptData(rawTitle),
            updatedAt: serverTimestamp()
          });
        }
      }

      // 1. Add user message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'user',
        content: encryptData(actualPrompt),
        attachments,
        createdAt: serverTimestamp()
      });

      // 2. Get AI response
      setIsChatLoading(true);
      
      // Prepare history with attachments
      const chatHistory: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments
      }));
      
      chatHistory.push({ role: 'user', content: actualPrompt, attachments });
      
      // Perform web search if requested
      if (isWebSearch) {
        const searchContext = await performWebSearch(actualPrompt);
        chatHistory[chatHistory.length - 1].content = `${searchContext}\n\nUSER QUESTION: ${actualPrompt}`;
      }
      
      const aiResponse = await getChatResponse(chatHistory, activePersona);

      // 3. Add AI message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'model',
        content: encryptData(aiResponse),
        createdAt: serverTimestamp()
      });

      // 4. Auto-generate intelligent title for first message
      const currentSession = sessions.find(s => s.id === sessionId);
      if (currentSession?.title === 'New Chat' || messages.length === 0) {
        try {
          const smartTitle = await generateTitle(content, aiResponse || '');
          await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
            title: encryptData(smartTitle),
            updatedAt: serverTimestamp()
          });
        } catch {
          // Fall back to truncated user message
          await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
            title: encryptData(content.slice(0, 30) + (content.length > 30 ? '...' : '')),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // 5. Update session timestamp
        await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
          updatedAt: serverTimestamp()
        });
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${sessionId || 'new'}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Regenerate: delete last AI message and re-generate without duplicating user message
  const handleRegenerate = useCallback(async () => {
    if (!user || !activeSessionId || messages.length < 2) return;
    
    const lastAiMessage = [...messages].reverse().find(m => m.role === 'model');
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastAiMessage || !lastUserMessage) return;
    
    setIsChatLoading(true);
    try {
      // 1. Delete the last AI message
      await deleteDoc(doc(db, 'users', user.uid, 'chats', activeSessionId, 'messages', lastAiMessage.id));
      
      // 2. Re-generate from existing history (without the deleted AI message)
      const chatHistory: ChatMessage[] = messages
        .filter(m => m.id !== lastAiMessage.id)
        .map(m => ({ role: m.role, content: m.content, attachments: m.attachments }));
      
      const aiResponse = await getChatResponse(chatHistory, activePersona);
      
      // 3. Save new AI response
      await addDoc(collection(db, 'users', user.uid, 'chats', activeSessionId, 'messages'), {
        role: 'model',
        content: encryptData(aiResponse),
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', user.uid, 'chats', activeSessionId), {
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${activeSessionId}`);
    } finally {
      setIsChatLoading(false);
    }
  }, [user, activeSessionId, messages, sessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K = New Chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Escape = Close settings
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [user, isCreatingChat]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!showApp) {
    return <LandingPage onGetStarted={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <ErrorBoundary>
        <Sidebar 
          sessions={sessions}
          activeSessionId={activeSessionId}
          user={user}
          onNewChat={handleNewChat}
          onSelectChat={setActiveSessionId}
          onUpdateTitle={handleUpdateSessionTitle}
          onDeleteChat={handleDeleteSession}
          onToggleSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
        />
      </ErrorBoundary>
      
      <main className="flex-1 min-w-0 bg-white relative">
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-medium text-amber-700">Connecting to secure server...</span>
          </div>
        )}
        <ErrorBoundary>
          <ChatInterface 
            messages={messages}
            isLoading={isChatLoading}
            onSendMessage={handleSendMessage}
            onGenerateImage={handleGenerateImage}
            activeSessionId={activeSessionId}
            onRegenerate={handleRegenerate}
            activePersona={activePersona}
            setActivePersona={setActivePersona}
          />
        </ErrorBoundary>
      </main>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        user={user}
      />
    </div>
  );
}

function SettingsModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const [selectedTab, setSelectedTab] = useState('Account');
  const [upgradeToast, setUpgradeToast] = useState(false);

  const [isPro, setIsPro] = useState(false);

  if (!isOpen) return null;

  const handlePaymentSuccess = (response: any) => {
    setIsPro(true);
    setUpgradeToast(true);
    setTimeout(() => setUpgradeToast(false), 5000);
    // In production, update user doc in Firestore to reflect Pro status
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[80vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-black"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 flex gap-8">
            <div className="w-48 space-y-2">
              <SettingsTab icon={<UserIcon className="w-4 h-4" />} label="Account" active={selectedTab === 'Account'} onClick={() => setSelectedTab('Account')} />
              <SettingsTab icon={<CreditCard className="w-4 h-4" />} label="Subscription" active={selectedTab === 'Subscription'} onClick={() => setSelectedTab('Subscription')} />
              <SettingsTab icon={<Shield className="w-4 h-4" />} label="Security" active={selectedTab === 'Security'} onClick={() => setSelectedTab('Security')} />
              <SettingsTab icon={<Bell className="w-4 h-4" />} label="Notifications" active={selectedTab === 'Notifications'} onClick={() => setSelectedTab('Notifications')} />
            </div>

            <div className="flex-1 space-y-8">
              {selectedTab === 'Account' && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Profile</h3>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                          {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{user?.displayName || 'User'}</p>
                      <p className="text-sm text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                </section>
              )}

              {selectedTab === 'Subscription' && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Plan</h3>
                  
                  {isPro ? (
                    <div className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-indigo-900">Keryo Pro ✦</p>
                        <p className="text-sm text-indigo-700">You have full access to all premium features.</p>
                      </div>
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Active</span>
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-semibold text-gray-900">Free Tier</p>
                          <p className="text-sm text-gray-500">Basic access to Keryo.</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-4">
                        <RazorpayButton 
                          amountInPaise={29900} 
                          planName="Keryo Pro" 
                          userEmail={user?.email || ''} 
                          userName={user?.displayName || ''} 
                          onSuccess={handlePaymentSuccess} 
                        />
                      </div>
                    </div>
                  )}

                  {upgradeToast && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium text-center flex justify-center items-center gap-2">
                      <Check className="w-4 h-4" /> Payment successful! Welcome to Pro.
                    </motion.div>
                  )}
                </section>
              )}

              {selectedTab === 'Security' && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Security</h3>
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">Two-Factor Authentication</p>
                        <p className="text-xs text-gray-400">Add an extra layer of security</p>
                      </div>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">Login Provider</p>
                        <p className="text-xs text-gray-400">Google OAuth 2.0</p>
                      </div>
                      <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>
                    </div>
                  </div>
                </section>
              )}

              {selectedTab === 'Notifications' && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Notifications</h3>
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                    <p className="text-sm text-gray-500">Notification preferences coming soon.</p>
                    <p className="text-xs text-gray-400 mt-1">You'll be able to manage email and push notifications here.</p>
                  </div>
                </section>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SettingsTab({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${active ? 'bg-gray-100 text-black font-semibold' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
    >
      {icon}
      {label}
    </button>
  );
}
