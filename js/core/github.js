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
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/main?recursive=1`;
    const res = await fetch(url, { headers: this.headers });
    const data = await res.json();
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
      content: window.btoa(unescape(encodeURIComponent(content))),
      branch: "main"
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
    // Fetch runs
    const runUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs?status=failure&per_page=1`;
    const runRes = await fetch(runUrl, { headers: this.headers });
    const runData = await runRes.json();
    
    if (runData.total_count === 0) return null;
    const runId = runData.workflow_runs[0].id;

    // Fetch jobs for the run
    const jobsUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs`;
    const jobsRes = await fetch(jobsUrl, { headers: this.headers });
    const jobsData = await jobsRes.json();
    
    const failedJob = jobsData.jobs.find(j => j.conclusion === 'failure');
    if (!failedJob) return null;

    // In a browser environment, downloading zip logs requires complex blob parsing.
    // We return job step context instead.
    const steps = failedJob.steps.filter(s => s.conclusion === 'failure');
    return `Job '${failedJob.name}' failed. Step: '${steps[0]?.name}'. Please verify syntax or dependency requirements for this step.`; 
  }
}
