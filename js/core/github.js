export class GitHubEngine {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  async getTree() {
    // 1. Fetch repo info to dynamically find the default branch (main vs master)
    const repoUrl = `https://api.github.com/repos/${this.owner}/${this.repo}`;
    const repoRes = await fetch(repoUrl, { headers: this.headers });
    if (!repoRes.ok) throw new Error(`Repository not found. Check name and token access.`);
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || "main";

    // 2. Fetch the file tree
    const treeUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${branch}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers: this.headers });
    
    // Catch empty repositories gracefully
    if (treeRes.status === 409) {
      throw new Error("The repository is completely empty! Please add a README file on GitHub first so Codey has a branch to map.");
    }
    
    if (!treeRes.ok) throw new Error(`GitHub API Error: ${await treeRes.text()}`);
    
    const data = await treeRes.json();
    if (!data.tree) throw new Error("No file tree returned from GitHub.");

    return data.tree.filter(i => i.type === 'blob' && !i.path.includes('.git')).map(i => i.path);
  }

  async getFile(path) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const res = await fetch(url, { headers: this.headers });
    if (res.status === 404) return { content: "// New File", sha: null };
    const data = await res.json();
    return {
      content: decodeURIComponent(escape(window.atob(data.content))),
      sha: data.sha
    };
  }

  async commitFile(path, content, message, sha) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const body = {
      message: message,
      content: window.btoa(unescape(encodeURIComponent(content)))
      // Removed hardcoded 'main' branch; GitHub API will automatically push to the default branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async getLatestFailedActionLog() {
    const runUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs?status=failure&per_page=1`;
    const runRes = await fetch(runUrl, { headers: this.headers });
    const runData = await runRes.json();
    
    if (!runData || runData.total_count === 0) return null;
    const runId = runData.workflow_runs[0].id;

    const jobsUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs`;
    const jobsRes = await fetch(jobsUrl, { headers: this.headers });
    const jobsData = await jobsRes.json();
    
    const failedJob = jobsData.jobs.find(j => j.conclusion === 'failure');
    if (!failedJob) return null;

    const steps = failedJob.steps.filter(s => s.conclusion === 'failure');
    return `Job '${failedJob.name}' failed. Step: '${steps[0]?.name}'. Please verify syntax or dependency requirements.`; 
  }
}
