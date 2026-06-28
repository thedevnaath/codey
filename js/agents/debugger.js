export class DebuggerAgent {
  constructor(llm, github, terminalLogger, architect) {
    this.llm = llm;
    this.github = github;
    this.log = terminalLogger;
    this.architect = architect;
  }

  async runDiagnostics(chatHistory) {
    this.log("agent", "Scanning GitHub Actions for CI/CD pipeline failures...");
    
    try {
      const errorLog = await this.github.getLatestFailedActionLog();
      
      if (!errorLog) {
        this.log("success", "✓ CI/CD Pipeline is green. No recent deployment failures.");
        return null;
      }

      this.log("error", `✗ Crash Detected:\n${errorLog}`);
      this.log("agent", "Formulating emergency patch...");

      const debugPrompt = `A deployment crashed with this log: ${errorLog}. Act as the Architect and output a JSON execution plan to patch the affected files.`;
      
      return await this.architect.generatePlan(debugPrompt, chatHistory);

    } catch (error) {
      throw new Error(`Debugger Diagnostics Failed: ${error.message}`);
    }
  }
}
