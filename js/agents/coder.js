export class CoderAgent {
  constructor(llm, github, terminalLogger) {
    this.llm = llm;
    this.github = github;
    this.log = terminalLogger;
    this.ticks = String.fromCharCode(96).repeat(3);
    this.maxRetries = 3;
  }

  async executePlan(plan, chatHistory) {
    this.log("agent", `Initiating Coder Pipeline for ${plan.filesToModify.length} files...`);

    for (const filePath of plan.filesToModify) {
      let success = false;
      let attempt = 0;

      while (!success && attempt < this.maxRetries) {
        attempt++;
        this.log("agent", `[${filePath}] Patching (Attempt ${attempt}/${this.maxRetries})...`);

        try {
          const fileState = await this.github.getFile(filePath);
          
          const coderPrompt = [
            `You are the Coder Agent. Modify ${filePath}.`,
            `Architect Goal: ${plan.explanation}`,
            `Current file content:`,
            this.ticks,
            fileState.content,
            this.ticks,
            "CRITICAL: Output ONLY raw code. No explanations. No markdown formatting blocks."
          ].join("\n");

          const rawOutput = await this.llm.prompt(coderPrompt, chatHistory);
          const cleanCode = this.sanitizeOutput(rawOutput);

          // Autonomous Git Commit
          await this.github.commitFile(
            filePath, 
            cleanCode, 
            `Codey Autonomous Patch: ${filePath}`, 
            fileState.sha
          );

          this.log("success", `✓ [${filePath}] Successfully committed to main.`);
          success = true;

        } catch (error) {
          this.log("error", `✗ [${filePath}] Write failed: ${error.message}`);
          if (attempt === this.maxRetries) {
            this.log("error", `Critical failure on ${filePath}. Skipping to next file.`);
          } else {
            // Exponential backoff before retry
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      }
    }
    this.log("success", "Execution Pipeline Complete. Awaiting next command.");
  }

  sanitizeOutput(text) {
    let clean = text.trim();
    if (clean.startsWith(this.ticks)) {
      const lines = clean.split("\n");
      lines.shift();
      if (lines[lines.length - 1].trim() === this.ticks) lines.pop();
      clean = lines.join("\n");
    }
    return clean;
  }
}
