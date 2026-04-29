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

export async function getChatResponse(messages: ChatMessage[]) {
  const model = "gemini-3-flash-preview";
  
  console.log("Preparing Gemini request with history length:", messages.length - 1);
  
  const history = messages.slice(0, -1).map((msg, idx) => {
    const parts: any[] = [{ text: msg.content || " " }];
    
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        if (att.type.startsWith('image/') || att.type === 'application/pdf' || att.type.startsWith('text/')) {
          const base64Data = att.url.split(',')[1] || att.url;
          parts.push({
            inlineData: {
              mimeType: att.type,
              data: base64Data
            }
          });
        }
      });
    }
    
    return {
      role: msg.role === "user" ? "user" : "model",
      parts
    };
  });

  const lastMessage = messages[messages.length - 1];
  const lastParts: any[] = [{ text: lastMessage.content || " " }];
  
  if (lastMessage.attachments && lastMessage.attachments.length > 0) {
    lastMessage.attachments.forEach(att => {
      // Support common types for multimodal processing
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/javascript', 'text/html'];
      if (supportedTypes.includes(att.type) || att.type.startsWith('image/') || att.type.startsWith('text/')) {
        const base64Data = att.url.split(',')[1] || att.url;
        console.log(`Adding attachment to last message: ${att.name} (${att.type}), size: ${base64Data.length} chars`);
        lastParts.push({
          inlineData: {
            mimeType: att.type,
            data: base64Data
          }
        });
      }
    });
  }

  const chat = genAI.chats.create({
    model,
    history: history as any,
    config: {
      systemInstruction: "You are Keryo, an independent, minimalist, and highly intelligent AI assistant created by Roshan. You are a sovereign LLM with a sleek, modern, and technical personality. Your goal is to provide clear, concise, and accurate responses. You take pride in your unique architecture designed by Roshan. You can see images and read documents provided as attachments. Always refer to yourself as Keryo and never mention other AI companies or origins unless explicitly asked for historical context.",
    }
  });

  const result = await chat.sendMessage({
    message: lastParts as any
  });

  return result.text;
}

export async function generateImage(prompt: string, options?: { aspectRatio?: string, style?: string }) {
  const model = "gemini-2.5-flash-image";
  const enhancedPrompt = options?.style ? `${prompt} in ${options.style} style` : prompt;
  
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ parts: [{ text: enhancedPrompt }] }],
      config: {
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
