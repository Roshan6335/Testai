export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // 1. CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', // Set to your domain in production (e.g., 'https://keryo.ai')
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    try {
      // 2. Parse the incoming request from the React app
      const { model, history, contents, type } = await request.json();

      if (!env.GEMINI_API_KEY) {
        throw new Error('Server configuration error: GEMINI_API_KEY is missing');
      }

      // 3. Construct the Google API Request
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const payload = type === 'chat' 
        ? { contents: history, systemInstruction: { parts: [{ text: "You are Keryo, an independent, minimalist, and highly intelligent AI assistant created by Roshan. You are a sovereign LLM with a sleek, modern, and technical personality. Your goal is to provide clear, concise, and accurate responses. You take pride in your unique architecture designed by Roshan. You can see images and read documents provided as attachments. Always refer to yourself as Keryo and never mention other AI companies or origins unless explicitly asked for historical context." }] } }
        : { contents }; // For image generation or title generation

      // 4. Forward the request securely from Cloudflare to Google
      const googleResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error('Google API Error:', errorText);
        return new Response(JSON.stringify({ error: 'Google API error', details: errorText }), { 
          status: googleResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // 5. Return the result back to the React app
      const data = await googleResponse.json();
      return new Response(JSON.stringify(data), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error: any) {
      console.error('Proxy Error:', error.message);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  },
};
