import { LLMEngine } from './core/llm.js';
import { GitHubEngine } from './core/github.js';

let llm, gh;
let chatHistory = [];
const terminal = document.getElementById('terminal');

document.getElementById('bootSystemBtn').addEventListener('click', async () => {
  const ghToken = document.getElementById('githubToken').value;
  const gemToken = document.getElementById('geminiToken').value;
  const owner = document.getElementById('repoOwner').value;
  const repo = document.getElementById('repoName').value;

  llm = new LLMEngine(gemToken);
  gh = new GitHubEngine(ghToken, owner, repo);

  document.getElementById('statusIndicator').innerText = "Discovering models...";
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
  document.getElementById('statusIndicator').innerText = "System Ready";
  
  printMsg("agent", "Codey OS v4 Active. Awaiting architectural directives.");
});

function printMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerText = text;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('promptInput');
  const text = input.value.trim();
  if (!text) return;
  
  input.value = '';
  printMsg("user", text);
  chatHistory.push({ role: "user", parts: [{ text }] });

  try {
    const tree = await gh.getTree();
    const sysPrompt = `You are the Architect Agent. Repo mapping: ${JSON.stringify(tree)}. Output JSON plan in format \`\`\`json { "filesToModify": ["path"] } \`\`\``;
    
    document.getElementById('statusIndicator').innerText = "Architect Analyzing...";
    const response = await llm.prompt(sysPrompt, chatHistory);
    chatHistory.push({ role: "model", parts: [{ text: response }] });
    
    const jsonMatch = response.match(/```json([\s\S]*?)```/);
    if (jsonMatch) {
       const plan = JSON.parse(jsonMatch[1]);
       printMsg("agent", "Plan generated. Engaging autonomous Coder execution sequence...");
       await executePlan(plan);
    } else {
       printMsg("agent", response);
    }
  } catch (e) {
    printMsg("error", e.message);
  }
  document.getElementById('statusIndicator').innerText = "System Ready";
});

async function executePlan(plan) {
  for (const path of plan.filesToModify) {
    printMsg("agent", `Patching ${path}...`);
    let retries = 0;
    let success = false;
    
    while (!success && retries < 3) {
      try {
        const fileData = await gh.getFile(path);
        const coderSys = `You are the Coder Agent. Modify this file based on user request. Output ONLY raw code. Current file:\n\n${fileData.content}`;
        const code = await llm.prompt(coderSys, chatHistory);
        
        let cleanCode = code;
        if (cleanCode.startsWith('```')) {
            const lines = cleanCode.split('\n');
            lines.shift();
            if (lines[lines.length-1].startsWith('```')) lines.pop();
            cleanCode = lines.join('\n');
        }

        await gh.commitFile(path, cleanCode, `Codey Autocommit: ${path}`, fileData.sha);
        printMsg("agent", `Successfully committed ${path}.`);
        success = true;
      } catch (e) {
        retries++;
        printMsg("error", `Coder failure on ${path}: ${e.message}. Retrying (${retries}/3)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!success) printMsg("error", `Autonomous execution aborted for ${path} after 3 attempts.`);
  }
}

document.getElementById('runDebuggerBtn').addEventListener('click', async () => {
  document.getElementById('statusIndicator').innerText = "Scanning CI/CD logs...";
  try {
    const errorData = await gh.getLatestFailedActionLog();
    if (!errorData) {
      printMsg("agent", "No recent GitHub Actions failures detected.");
    } else {
      printMsg("error", `CI/CD Failure Detected: ${errorData}`);
      printMsg("agent", "Engaging Debugger Agent...");
      
      const debugSys = `You are the Debugger Agent. A GitHub Action failed with this context: ${errorData}. Analyze the history and propose an automated fix via JSON plan exactly like the Architect.`;
      const response = await llm.prompt(debugSys, chatHistory);
      
      const jsonMatch = response.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        printMsg("agent", "Fix identified. Deploying patch...");
        await executePlan(JSON.parse(jsonMatch[1]));
      } else {
        printMsg("agent", "Analysis complete, but unable to formulate an automatic file patch. Manual review required.");
        printMsg("agent", response);
      }
    }
  } catch (e) {
    printMsg("error", `Debugger failure: ${e.message}`);
  }
  document.getElementById('statusIndicator').innerText = "System Ready";
});
