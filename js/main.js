import { LLMEngine } from './core/llm.js';
import { GitHubEngine } from './core/github.js';
import { ArchitectAgent } from './agents/architect.js';
import { CoderAgent } from './agents/coder.js';
import { DebuggerAgent } from './agents/debugger.js';

const terminal = document.getElementById('terminal');
const status = document.getElementById('statusIndicator');
let chatHistory = [];
let llm, github, architect, coder, debuggerAgent;

// --- Terminal Logger ---
function print(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  
  // Clean up JSON blocks from the UI view for aesthetics
  const cleanText = text.replace(/```json[\s\S]*?```/g, '\n[Structured Data Extracted]');
  div.innerText = cleanText;
  
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

// --- System Boot ---
document.getElementById('bootSystemBtn').addEventListener('click', async () => {
  const ghToken = document.getElementById('githubToken').value;
  const gemToken = document.getElementById('geminiToken').value;
  const owner = document.getElementById('repoOwner').value;
  const repo = document.getElementById('repoName').value;

  if (!ghToken || !gemToken || !owner || !repo) return alert("Missing credentials.");

  status.innerText = "Initializing Neural Engines...";
  llm = new LLMEngine(gemToken);
  github = new GitHubEngine(ghToken, owner, repo);

  // Initialize Agents
  architect = new ArchitectAgent(llm, github, print);
  coder = new CoderAgent(llm, github, print);
  debuggerAgent = new DebuggerAgent(llm, github, print, architect);

  // Load Models
  const models = await llm.discoverModels();
  const select = document.getElementById('modelSelector');
  select.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = m;
    select.appendChild(opt);
  });

  document.getElementById('authView').classList.add('hidden');
  document.getElementById('workspaceView').classList.remove('hidden');
  status.innerText = "System Online";
  
  print("success", `Codey OS Final connected to ${owner}/${repo}`);
});

// --- Main Chat/Execution Loop ---
document.getElementById('sendBtn').addEventListener('click', async () => {
  const inputEl = document.getElementById('promptInput');
  const userText = inputEl.value.trim();
  if (!userText) return;
  
  inputEl.value = '';
  print("user", userText);
  chatHistory.push({ role: "user", parts: [{ text: userText }] });

  status.innerText = "Processing...";
  document.getElementById('sendBtn').disabled = true;

  try {
    const plan = await architect.generatePlan(userText, chatHistory);
    if (plan && plan.filesToModify.length > 0) {
      await coder.executePlan(plan, chatHistory);
    }
  } catch (error) {
    print("error", error.message);
  }

  status.innerText = "System Online";
  document.getElementById('sendBtn').disabled = false;
});

// --- Autonomous Debugger Hook ---
document.getElementById('runDebuggerBtn').addEventListener('click', async () => {
  document.getElementById('runDebuggerBtn').disabled = true;
  status.innerText = "Running Diagnostics...";

  try {
    const fixPlan = await debuggerAgent.runDiagnostics(chatHistory);
    if (fixPlan && fixPlan.filesToModify.length > 0) {
      await coder.executePlan(fixPlan, chatHistory);
    }
  } catch (error) {
    print("error", error.message);
  }

  status.innerText = "System Online";
  document.getElementById('runDebuggerBtn').disabled = false;
});
