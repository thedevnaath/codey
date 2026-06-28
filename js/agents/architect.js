export class ArchitectAgent {
  constructor(llm, github, terminalLogger) {
    this.llm = llm;
    this.github = github;
    this.log = terminalLogger;
    this.ticks = String.fromCharCode(96).repeat(3);
  }

  async generatePlan(userPrompt, chatHistory) {
    this.log("agent", "Architect is mapping the repository state...");
    
    try {
      const tree = await this.github.getTree();
      
      const sysPrompt = [
        "You are the Principal Architect Agent.",
        "Your job is to analyze the user request against this repository tree:",
        JSON.stringify(tree),
        "Determine exactly which files must be created or modified.",
        `Output a JSON execution plan at the very end enclosed in ${this.ticks}json ... ${this.ticks}.`,
        "Format:",
        "{",
        "  \"explanation\": \"Brief technical strategy.\",",
        "  \"filesToModify\": [\"path/to/file1.js\", \"path/to/file2.css\"]",
        "}"
      ].join("\n");

      this.log("agent", "Synthesizing architectural blueprint...");
      const response = await this.llm.prompt(sysPrompt, chatHistory);
      
      chatHistory.push({ role: "model", parts: [{ text: response }] });

      const regex = new RegExp(`${this.ticks}json([\\s\\S]*?)${this.ticks}`);
      const match = response.match(regex);
      
      if (match) {
        const plan = JSON.parse(match[1].trim());
        this.log("agent", `Blueprint locked: ${plan.filesToModify.length} files targeted.`);
        return plan;
      } else {
        this.log("agent", response); // Conversational fallback
        return null;
      }
    } catch (error) {
      throw new Error(`Architect Pipeline Failed: ${error.message}`);
    }
  }
}
