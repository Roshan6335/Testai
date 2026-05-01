# Keryo AI

Minimalist AI chatbot powered by Google Gemini, with 3D landing page and chat history via Firebase.

## 🚀 Deploy on Vercel (Step-by-Step)

### Step 1 — Get your Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key** → copy it

### Step 2 — Set up Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project (or create a new one)
3. **Enable Google Auth**: Authentication → Sign-in method → Google → Enable
4. **Add Authorized Domain**: Authentication → Settings → Authorized domains → Add your Vercel URL (e.g., `keryo-ai.vercel.app`)
5. **Enable Firestore**: Firestore Database → Create database (start in test mode)
6. Go to **Project Settings → Your apps → Web app** → copy the config values
7. Deploy Firestore rules: copy contents of `firestore.rules` into Firestore → Rules tab

### Step 3 — Deploy on Vercel
1. Push this project to GitHub (make sure `.env` is in `.gitignore`)
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. In **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Gemini API key
   - `VITE_FIREBASE_API_KEY` = from Firebase config
   - `VITE_FIREBASE_AUTH_DOMAIN` = from Firebase config
   - `VITE_FIREBASE_PROJECT_ID` = from Firebase config
   - `VITE_FIREBASE_STORAGE_BUCKET` = from Firebase config
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = from Firebase config
   - `VITE_FIREBASE_APP_ID` = from Firebase config
4. Click **Deploy** ✅

### Step 4 — After Vercel gives you a URL
Go back to Firebase Console → Authentication → Authorized domains → add your `.vercel.app` URL.

## Local Development

```bash
cp .env.example .env
# Fill in .env with your keys
npm install
npm run dev
```
