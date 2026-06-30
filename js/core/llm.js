export class LLMEngine {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.availableModels = [];
    this.activeModelIndex = 0;
  }

  async discoverModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      this.availableModels = data.models
        .filter(m => m.name.includes("gemini") && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace('models/', ''));
      
      // Prioritize flash models for coding speed
      this.availableModels.sort((a, b) => {
        if (a.includes('flash') && !b.includes('flash')) return -1;
        return 0;
      });
      return this.availableModels;
    } catch (e) {
      console.error("Model discovery failed", e);
      return ["gemini-2.5-flash", "gemini-1.5-flash"];
    }
  }

  async prompt(systemInstruction, history, retryCount = 0) {
    const currentModel = this.availableModels[this.activeModelIndex] || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${this.apiKey}`;
    
    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: history
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 429 || response.status === 503) {
        if (this.activeModelIndex < this.availableModels.length - 1) {
          console.warn(`Model ${currentModel} exhausted. Swapping to fallback...`);
          this.activeModelIndex++;
          return this.prompt(systemInstruction, history, 0); // Hot swap and retry
        }
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
          return this.prompt(systemInstruction, history, retryCount + 1);
        }
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      // --- FAULT-TOLERANT VALIDATION: SAFETY FILTER HANDLING ---
      if (!data.candidates || data.candidates.length === 0) {
        if (data.promptFeedback && data.promptFeedback.blockReason) {
          throw new Error(`Blocked by Gemini safety filters. Reason: ${data.promptFeedback.blockReason}`);
        }
        throw new Error(`No text candidates returned. Structure: ${JSON.stringify(data)}`);
      }

      const candidate = data.candidates[0];
      
      // Intercept mid-generation execution blocks
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        if (candidate.finishReason === "SAFETY") {
          throw new Error("Generation was terminated mid-stream due to content safety heuristics.");
        }
      }

      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error("Candidate returned valid wrapper structure but contains empty content text components.");
      }
      
      return candidate.content.parts[0].text || "";
    } catch (e) {
      throw new Error(`LLM Failure: ${e.message}`);
    }
  }
}
