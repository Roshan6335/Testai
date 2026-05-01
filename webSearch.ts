/**
 * Performs a web search using the Tavily API, which is optimized for LLMs.
 * Returns a concatenated string of the most relevant search results.
 */
export async function performWebSearch(query: string): Promise<string> {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error("VITE_TAVILY_API_KEY is not configured.");
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: true,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Format the results into a clean string for the LLM context
    let contextString = `[WEB SEARCH RESULTS FOR: "${query}"]\n\n`;
    
    if (data.answer) {
      contextString += `SUMMARY:\n${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      contextString += `SOURCES:\n`;
      data.results.forEach((result: any, index: number) => {
        contextString += `${index + 1}. ${result.title}\nURL: ${result.url}\nSnippet: ${result.content}\n\n`;
      });
    } else {
      contextString += "No relevant results found on the web.";
    }

    return contextString;
  } catch (error) {
    console.error("Web search failed:", error);
    return `[WEB SEARCH FAILED] Could not retrieve live information for "${query}". Please proceed with your existing knowledge base.`;
  }
}
