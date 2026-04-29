import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser,
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { getChatResponse, generateImage, ChatMessage } from './lib/gemini';
import { compressImage, fileToBase64 } from './lib/imageUtils';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, User as UserIcon, Shield, Bell } from 'lucide-react';

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

  useEffect(() => {
    // Health check
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsOnline(true);
      } catch (error: any) {
        if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
          console.warn("Firestore is currently offline or unreachable. Retrying...");
          setIsOnline(false);
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
      const chatSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSessions(chatSessions);
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
      const chatMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(chatMessages);
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
        title: newTitle,
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
          title: `Image: ${prompt.slice(0, 20)}...`,
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
            title: `Image: ${prompt.slice(0, 20)}...`,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 2. Add user message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'user',
        content: `Generate image: ${prompt}${options?.style ? ` (Style: ${options.style})` : ''}${options?.aspectRatio ? ` (Ratio: ${options.aspectRatio})` : ''}`,
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
        content: `Here is the image I generated for: "${prompt}"`,
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
      // 1. Delete the chat document
      await deleteDoc(doc(db, 'users', user.uid, 'chats', sessionId));
      
      // Note: In a real production app with high volume, you'd use a Cloud Function or batch
      // to delete the subcollection "messages". For this app, deleting the session doc
      // is enough for it to disappear from the UI.
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chats/${sessionId}`);
    }
  };

  const handleNewChat = async () => {
    if (!user) return;
    
    try {
      const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
        userId: user.uid,
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveSessionId(chatRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats`);
    }
  };

  const handleSendMessage = async (content: string, attachment?: File | null) => {
    if (!user) return;

    let sessionId = activeSessionId;
    let attachments: any[] = [];
    let aiAttachments: any[] = [];

    if (attachment) {
      if (attachment.size > 800 * 1024) { // Warning if > 800KB
        console.warn("Large attachment detected. Firestore document limit is 1MB.");
      }

      // For local display and persistence (limited to 1MB total doc size)
      let firestoreUrl = "";
      
      // If it's an image, consider compression
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

    try {
      // Create session if none exists
      if (!sessionId) {
        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          userId: user.uid,
          title: content ? (content.slice(0, 30) + (content.length > 30 ? '...' : '')) : (attachment ? `File: ${attachment.name}` : 'New Chat'),
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
            title: content ? (content.slice(0, 30) + (content.length > 30 ? '...' : '')) : (attachment ? `File: ${attachment.name}` : 'New Chat'),
            updatedAt: serverTimestamp()
          });
        }
      }

      // 1. Add user message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'user',
        content,
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
      
      chatHistory.push({ role: 'user', content, attachments });
      
      const aiResponse = await getChatResponse(chatHistory);

      // 3. Add AI message
      await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
        role: 'model',
        content: aiResponse,
        createdAt: serverTimestamp()
      });

      // 4. Update session timestamp
      await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${sessionId || 'new'}`);
    } finally {
      setIsChatLoading(false);
    }
  };

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
      
      <main className="flex-1 min-w-0 bg-white relative">
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-medium text-amber-700">Connecting to secure server...</span>
          </div>
        )}
        <ChatInterface 
          messages={messages}
          isLoading={isChatLoading}
          onSendMessage={handleSendMessage}
          onGenerateImage={handleGenerateImage}
          activeSessionId={activeSessionId}
          onRegenerate={() => {
            if (messages.length > 0) {
              const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
              if (lastUserMessage) {
                handleSendMessage(lastUserMessage.content);
              }
            }
          }}
        />
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
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 flex gap-8">
            <div className="w-48 space-y-2">
              <SettingsTab icon={<UserIcon className="w-4 h-4" />} label="Account" active />
              <SettingsTab icon={<CreditCard className="w-4 h-4" />} label="Subscription" />
              <SettingsTab icon={<Shield className="w-4 h-4" />} label="Security" />
              <SettingsTab icon={<Bell className="w-4 h-4" />} label="Notifications" />
            </div>

            <div className="flex-1 space-y-8">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Profile</h3>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
                    <img src={user?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold">{user?.displayName}</p>
                    <p className="text-sm text-gray-400">{user?.email}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Plan</h3>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Free Tier</p>
                    <p className="text-sm text-gray-400">Basic access to Keryo.</p>
                  </div>
                  <button className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all shadow-sm">
                    Upgrade to Pro
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Integrations</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="text-sm font-medium">Razorpay (Future)</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SettingsTab({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${active ? 'bg-gray-100 text-black font-semibold' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>
      {icon}
      {label}
    </button>
  );
}
