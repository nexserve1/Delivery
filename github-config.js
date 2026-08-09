/* ==========================================================================
   NEXSERVE — github-config.js
   PUBLIC, safe-to-commit config. Contains NO secrets/tokens.

   This tells the app which GitHub repo holds the shared order data
   (data/orders/<trackingId>.json). Both the admin app (to push updates)
   and the public tracking page (to read updates) use this file.

   If you deploy on GitHub Pages at https://USERNAME.github.io/REPO/,
   owner/repo are auto-detected below — you usually don't need to edit
   anything. Only fill these in manually if you use a custom domain.
   ========================================================================== */

const GITHUB_SYNC_CONFIG = {
  owner: '',            // e.g. 'yourusername' — leave blank to auto-detect on github.io
  repo: '',             // e.g. 'nexserve-orders' — leave blank to auto-detect on github.io
  branch: 'main',       // the branch your GitHub Pages site is built from
  folder: 'data/orders' // folder inside the repo where order JSON files are stored
};

function resolveGitHubRepoInfo(){
  const cfg = Object.assign({}, GITHUB_SYNC_CONFIG);
  // Allow a runtime override saved by the admin in Settings (localStorage),
  // useful for local testing before the first GitHub Pages deploy.
  try{
    const override = JSON.parse(localStorage.getItem('nexserve_github_repo_override') || 'null');
    if(override) Object.assign(cfg, override);
  }catch(e){ /* ignore */ }

  if(!cfg.owner || !cfg.repo){
    // Auto-detect from https://USERNAME.github.io/REPO/... URLs
    const host = window.location.hostname; // e.g. username.github.io
    const parts = window.location.pathname.split('/').filter(Boolean); // ['REPO', 'tracking.html']
    if(host.endsWith('.github.io')){
      cfg.owner = cfg.owner || host.replace('.github.io', '');
      cfg.repo = cfg.repo || parts[0] || '';
    }
  }
  return cfg;
}
