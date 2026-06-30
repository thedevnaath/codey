import { LLMEngine } from './core/llm.js';
import { GitHubEngine } from './core/github.js';
import { ArchitectAgent } from './agents/architect.js';
import { CoderAgent } from './agents/coder.js';
import { DebuggerAgent } from './agents/debugger.js';

const terminal = document.getElementById('terminal');
const status = document.getElementById('statusIndicator');
let chatHistory = [];
let llm, github, architect, coder, debuggerAgent;

// --- 1. PERSISTENCE LAYER: RESTORE STATE ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('githubToken').value = localStorage.getItem('codey_gh_token') || '';
  document.getElementById('geminiToken').value = localStorage.getItem('codey_gemini_token') || '';
  document.getElementById('repoOwner').value = localStorage.getItem('codey_owner') || '';
  document.getElementById('repoName').value = localStorage.getItem('codey_repo') || '';

  const savedHistory = localStorage.getItem('codey_chat_history');
  if (savedHistory) {
    try {
      chatHistory = JSON.parse(savedHistory);
      chatHistory.forEach(msg => {
        if (msg.role === 'user' && !msg.parts[0].text.includes('You are the Principal Architect Agent')) {
          print('user', msg.parts[0].text);
        } else if (msg.role === 'model' && !msg.parts[0].text.includes('Understood.')) {
          print('agent', msg.parts[0].text);
        }
      });
    } catch (e) {
      console.error("Failed to restore history state:", e);
    }
  }
});

// --- Terminal Logger ---
function print(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  
  const cleanText = text.replace(/```(?:json)?\s*[\s\S]*?```/g, '\n[Structured Plan Extracted]');
  div.innerText = cleanText;
  
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

// --- 2. SYSTEM BOOT ENGINE ---
document.getElementById('bootSystemBtn').addEventListener('click', async () => {
  const ghToken = document.getElementById('githubToken').value.trim();
  const gemToken = document.getElementById('geminiToken').value.trim();
  const owner = document.getElementById('repoOwner').value.trim();
  const repo = document.getElementById('repoName').value.trim();

  if (!ghToken || !gemToken || !owner || !repo) return alert("All fields are required.");

  localStorage.setItem('codey_gh_token', ghToken);
  localStorage.setItem('codey_gemini_token', gemToken);
  localStorage.setItem('codey_owner', owner);
  localStorage.setItem('codey_repo', repo);

  status.innerText = "Initializing Neural Engines...";
  llm = new LLMEngine(gemToken);
  github = new GitHubEngine(ghToken, owner, repo);

  architect = new ArchitectAgent(llm, github, print);
  coder = new CoderAgent(llm, github, print);
  debuggerAgent = new DebuggerAgent(llm, github, print, architect);

  try {
    const models = await llm.discoverModels();
    const select = document.getElementById('modelSelector');
    select.innerHTML = '';
    
    models.forEach((m, index) => {
      const opt = document.createElement('option');
      opt.value = index; 
      opt.innerText = m;
      select.appendChild(opt);
    });

    // --- 3. DYNAMIC DROPDOWN MODEL ROUTING ---
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.value, 10);
      llm.activeModelIndex = index;
      print("agent", `Switched active pipeline routing to: ${models[index]}`);
    });

    document.getElementById('authView').classList.add('hidden');
    document.getElementById('workspaceView').classList.remove('hidden');
    status.innerText = "System Online";
    print("success", `Connected to workspace repository: ${owner}/${repo}`);
  } catch (err) {
    status.innerText = "Connection Error";
    alert("System initialization failed: " + err.message);
  }
});

// --- 4. COGNITIVE STRATEGY LOOP ---
document.getElementById('sendBtn').addEventListener('click', async () => {
  const inputEl = document.getElementById('promptInput');
  const userText = inputEl.value.trim();
  if (!userText) return;
  
  inputEl.value = '';
  print("user", userText);
  
  chatHistory.push({ role: "user", parts: [{ text: userText }] });
  localStorage.setItem('codey_chat_history', JSON.stringify(chatHistory));

  status.innerText = "Processing...";
  document.getElementById('sendBtn').disabled = true;

  try {
    const plan = await architect.generatePlan(userText, chatHistory);
    localStorage.setItem('codey_chat_history', JSON.stringify(chatHistory));
    
    if (plan && plan.filesToModify && plan.filesToModify.length > 0) {
      await coder.executePlan(plan, chatHistory);
      localStorage.setItem('codey_chat_history', JSON.stringify(chatHistory));
    }
  } catch (error) {
    print("error", error.message);
  }

  status.innerText = "System Online";
  document.getElementById('sendBtn').disabled = false;
});

// --- 5. AUTOMATED DEPLOYMENT DIAGNOSTICS REPAIR LOOP ---
document.getElementById('runDebuggerBtn').addEventListener('click', async () => {
  document.getElementById('runDebuggerBtn').disabled = true;
  status.innerText = "Scanning CI/CD logs...";

  try {
    const fixPlan = await debuggerAgent.runDiagnostics(chatHistory);
    localStorage.setItem('codey_chat_history', JSON.stringify(chatHistory));
    
    if (fixPlan && fixPlan.filesToModify && fixPlan.filesToModify.length > 0) {
      await coder.executePlan(fixPlan, chatHistory);
      localStorage.setItem('codey_chat_history', JSON.stringify(chatHistory));
    }
  } catch (error) {
    print("error", error.message);
  }

  status.innerText = "System Online";
  document.getElementById('runDebuggerBtn').disabled = false;
});
