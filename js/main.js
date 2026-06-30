import { LLMEngine } from './core/llm.js';
import { GitHubEngine } from './core/github.js';
import { ArchitectAgent } from './agents/architect.js';
import { CoderAgent } from './agents/coder.js';
import { DebuggerAgent } from './agents/debugger.js';

const terminal = document.getElementById('terminal');
const status = document.getElementById('statusIndicator');
let chatHistory = [];
let llm, github, architect, coder, debuggerAgent;

// --- Session Persistence Recovery ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('githubToken').value = localStorage.getItem('codey_gh_token') || '';
  document.getElementById('geminiToken').value = localStorage.getItem('codey_gemini_token') || '';
  document.getElementById('repoOwner').value = localStorage.getItem('codey_owner') || '';
  document.getElementById('repoName').value = localStorage.getItem('codey_repo') || '';
  
  // Restore Chat Log Session from local state if it exists
  const savedHistory = localStorage.getItem('codey_chat_history');
  if (savedHistory) {
    try {
      chatHistory = JSON.parse(savedHistory);
      // Filter out system systemInstructions and render history nicely
      chatHistory.forEach(msg => {
        if (msg.role === "user" && !msg.parts[0].text.includes("You are the Principal Architect Agent")) {
          print("user", msg.parts[0].text);
        } else if (msg.role === "model" && !msg.parts[0].text.includes("Understood. I am ready")) {
          print("assistant", msg.parts[0].text);
        }
      });
    } catch (e) {
      console.warn("Failed to restore chat history", e);
    }
  }
});

// --- High-Fidelity Terminal Logger ---
function print(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  
  // Clean up JSON blocks from the interface view for visual aesthetics
  const cleanText = text.replace(/
