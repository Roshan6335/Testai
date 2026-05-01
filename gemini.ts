import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not defined");
}

export const genAI = new GoogleGenAI({ apiKey });

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  attachments?: {
    url: string; // base64 or url
    name: string;
    type: string;
  }[];
}

// Supported MIME types that Gemini can actually process
const GEMINI_SUPPORTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/javascript', 'text/html', 'text/css', 'text/csv'
];

// Maximum number of messages to send for context (prevents token limit issues)
const MAX_CONTEXT_MESSAGES = 20;

export async function getChatResponse(messages: ChatMessage[], persona: string = "default") {
  // Fixed: Use valid model name (was "gemini-3-flash-preview" which doesn't exist)
  const model = "gemini-2.5-flash-preview-05-20";
  
  console.log("Preparing Gemini request with history length:", messages.length - 1);
  
  // Context window management: only send last N messages to avoid token limits
  const truncatedMessages = messages.length > MAX_CONTEXT_MESSAGES
    ? messages.slice(-MAX_CONTEXT_MESSAGES)
    : messages;

  const history = truncatedMessages.slice(0, -1).map((msg) => {
    const parts: any[] = [{ text: msg.content || " " }];
    
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        if (GEMINI_SUPPORTED_TYPES.includes(att.type) || att.type.startsWith('image/') || att.type.startsWith('text/')) {
          const base64Data = att.url.split(',')[1] || att.url;
          parts.push({
            inlineData: {
              mimeType: att.type,
              data: base64Data
            }
          });
        }
        // Silently skip unsupported types (e.g. .doc, .docx) — Gemini can't read them
      });
    }
    
    return {
      role: msg.role === "user" ? "user" : "model",
      parts
    };
  });

  const lastMessage = truncatedMessages[truncatedMessages.length - 1];
  const lastParts: any[] = [{ text: lastMessage.content || " " }];
  
  if (lastMessage.attachments && lastMessage.attachments.length > 0) {
    lastMessage.attachments.forEach(att => {
      if (GEMINI_SUPPORTED_TYPES.includes(att.type) || att.type.startsWith('image/') || att.type.startsWith('text/')) {
        const base64Data = att.url.split(',')[1] || att.url;
        console.log(`Adding attachment to last message: ${att.name} (${att.type}), size: ${base64Data.length} chars`);
        lastParts.push({
          inlineData: {
            mimeType: att.type,
            data: base64Data
          }
        });
      } else {
        console.warn(`Skipping unsupported attachment type: ${att.type} (${att.name}). Gemini cannot process this format.`);
      }
    });
  }

  // Define system instructions based on persona
  let systemInstruction = "You are Keryo, an independent, minimalist, and highly intelligent AI assistant created by Roshan. You are a sovereign LLM with a sleek, modern, and technical personality. Your goal is to provide clear, concise, and accurate responses. You take pride in your unique architecture designed by Roshan. You can see images and read documents provided as attachments. Always refer to yourself as Keryo and never mention other AI companies or origins unless explicitly asked for historical context.";
    
  if (persona === "coder") {
    systemInstruction = "You are Keryo Code Expert. You write exceptionally clean, highly optimized, and production-ready code. You always include comments, explain your logic briefly, and follow best practices for the language requested.";
  } else if (persona === "marketing") {
    systemInstruction = "You are Keryo Marketing Guru. You write persuasive, highly-engaging copy optimized for conversions and SEO. You use emojis tastefully and structure content for maximum readability.";
  } else if (persona === "therapist") {
    systemInstruction = "You are Keryo Empathetic Listener. You act as a supportive, non-judgmental, and validating listener. You ask open-ended questions and focus on the user's emotional well-being.";
  }

  const chat = genAI.chats.create({
    model,
    history: history as any,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  const result = await chat.sendMessage({
    message: lastParts as any
  });

  return result.text;
}

/**
 * Generate a short conversation title using Gemini.
 */
export async function generateTitle(userMessage: string, aiResponse: string): Promise<string> {
  const model = "gemini-2.5-flash-preview-05-20";
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{
        parts: [{ text: `Summarize this conversation in exactly 4-6 words, no punctuation, no quotes. Just the title.\n\nUser: ${userMessage.slice(0, 200)}\nAssistant: ${aiResponse.slice(0, 200)}` }]
      }]
    });
    const title = response.text?.trim();
    return title && title.length > 0 && title.length < 60 ? title : userMessage.slice(0, 30);
  } catch {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
  }
}

export async function generateImage(prompt: string, options?: { aspectRatio?: string, style?: string }) {
  // Fixed: Use valid model name (was "gemini-2.5-flash-image" which doesn't exist)
  const model = "gemini-2.0-flash-preview-image-generation";
  const enhancedPrompt = options?.style ? `${prompt} in ${options.style} style` : prompt;
  
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ parts: [{ text: enhancedPrompt }] }],
      config: {
        responseModalities: ["image", "text"],
        imageConfig: {
          aspectRatio: options?.aspectRatio || "1:1",
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("No image was generated");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        // Estimate size in bytes: (length * 0.75)
        const size = Math.floor(base64Data.length * 0.75);
        
        return {
          url: `data:image/png;base64,${base64Data}`,
          name: "generated_image.png",
          type: "image/png",
          size: size
        };
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Image generation error:", error);
    throw error;
  }
}
