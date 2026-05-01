import CryptoJS from 'crypto-js';

// Get encryption key from environment variable. 
// Fallback to a hardcoded string ONLY for development. 
// In production, MUST use VITE_ENCRYPTION_KEY in Vercel/Cloudflare dashboard.
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'keryo-default-secure-dev-key-2026';

export const encryptData = (text: string): string => {
  if (!text) return text;
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Encryption failed", error);
    return text; // Fallback to plain text if encryption fails
  }
};

export const decryptData = (ciphertext: string): string => {
  if (!ciphertext) return ciphertext;
  try {
    // Basic check to see if it looks like base64 ciphertext from AES
    if (!ciphertext.includes('U2FsdGVkX1')) {
      return ciphertext; // It's probably plain text from before we added encryption
    }
    
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    // If decryption fails, it returns an empty string
    return decryptedText || ciphertext;
  } catch (error) {
    console.error("Decryption failed", error);
    return ciphertext; // Fallback to returning raw data
  }
};
