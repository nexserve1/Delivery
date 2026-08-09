/* ==========================================================================
   NEXSERVE — github-sync.js  (ADMIN ONLY — not loaded on tracking.html)

   Pushes a PUBLIC-SAFE subset of each order to a per-order JSON file in
   your GitHub repo, so the tracking page (any device, no login) can read
   live status straight from GitHub. Uses the GitHub Contents REST API,
   called directly from the browser — no backend server needed.

   SECURITY:
   - Requires a GitHub Personal Access Token with **only** "Contents:
     Read and write" permission on this ONE repository (a fine-grained
     token, not a classic all-access token).
   - The token is stored ONLY in this browser's localStorage
     (nexserve_github_token) — it is never included in Backup exports and
     never committed to the repo.
   - Because the repo must be public for the tracking page to read data
     without a token, treat every field pushed here as PUBLIC. Only a
     filtered subset of each order is ever sent — see buildPublicOrder().
   ========================================================================== */

const GH_TOKEN_KEY = 'nexserve_github_token';

function getGithubToken(){ return localStorage.getItem(GH_TOKEN_KEY) || ''; }
function saveGithubToken(token){
  if(token) localStorage.setItem(GH_TOKEN_KEY, token);
  else localStorage.removeItem(GH_TOKEN_KEY);
}
function isGithubSyncConfigured(){
  const cfg = resolveGitHubRepoInfo();
  return !!(cfg.owner && cfg.repo && getGithubToken());
}

/* Only these fields ever leave the browser and get written to the public
   repo. Never include: mobile, whatsapp, email, address, pincode,
   paymentStatus, paymentMethod, amount, deliveryCharge, notes, invoice,
   invoiceFileName. */
function buildPublicOrder(order){
  return {
    trackingId: order.trackingId,
    orderId: order.orderId,
    customerName: order.customerName,
    product: order.product,
    model: order.model || '',
    quantity: order.quantity,
    orderDate: order.orderDate,
    expectedDelivery: order.expectedDelivery || '',
    currentStatus: order.currentStatus,
    currentLocation: order.currentLocation || '',
    latestUpdate: order.latestUpdate || '',
    updatedAt: order.updatedAt,
    timeline: (order.timeline || []).map(t => ({
      status: t.status, date: t.date, note: t.note || '', location: t.location || ''
    }))
  };
}

function ghApiUrl(path){
  const cfg = resolveGitHubRepoInfo();
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
}
function ghFilePath(trackingId){
  const cfg = resolveGitHubRepoInfo();
  return `${cfg.folder}/${encodeURIComponent(trackingId)}.json`;
}
function b64EncodeUnicode(str){
  return btoa(unescape(encodeURIComponent(str)));
}

async function ghGetFileSha(path){
  const cfg = resolveGitHubRepoInfo();
  const res = await fetch(`${ghApiUrl(path)}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: { Authorization: `Bearer ${getGithubToken()}`, Accept: 'application/vnd.github+json' }
  });
  if(res.status === 404) return null;
  if(!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const data = await res.json();
  return data.sha;
}

/* Push (create or update) one order's public JSON file to GitHub. */
async function pushOrderToGitHub(order){
  if(!isGithubSyncConfigured()) return { ok:false, skipped:true };
  const cfg = resolveGitHubRepoInfo();
  const path = ghFilePath(order.trackingId);
  try{
    const sha = await ghGetFileSha(path);
    const body = {
      message: `Update order ${order.trackingId} — ${order.currentStatus}`,
      content: b64EncodeUnicode(JSON.stringify(buildPublicOrder(order), null, 2)),
      branch: cfg.branch
    };
    if(sha) body.sha = sha;
    const res = await fetch(ghApiUrl(path), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${getGithubToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const errText = await res.text();
      throw new Error(`GitHub push failed (${res.status}): ${errText.slice(0,150)}`);
    }
    localStorage.setItem('nexserve_last_gh_sync', new Date().toISOString());
    return { ok:true };
  }catch(err){
    console.error('GitHub sync error:', err);
    return { ok:false, error: err.message };
  }
}

/* Remove an order's file from GitHub when the order is deleted in admin. */
async function deleteOrderFromGitHub(trackingId){
  if(!isGithubSyncConfigured()) return { ok:false, skipped:true };
  const cfg = resolveGitHubRepoInfo();
  const path = ghFilePath(trackingId);
  try{
    const sha = await ghGetFileSha(path);
    if(!sha) return { ok:true }; // already gone
    const res = await fetch(ghApiUrl(path), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getGithubToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `Delete order ${trackingId}`, sha, branch: cfg.branch })
    });
    if(!res.ok) throw new Error(`GitHub delete failed (${res.status})`);
    return { ok:true };
  }catch(err){
    console.error('GitHub delete error:', err);
    return { ok:false, error: err.message };
  }
}

/* Fire-and-forget wrapper used throughout the admin UI so order saves are
   never blocked waiting on network/GitHub. */
function syncOrderToGitHubBackground(order){
  if(!isGithubSyncConfigured()) return;
  pushOrderToGitHub(order).then(result => {
    if(result.ok) toast('Synced to GitHub — customer link is live.', 'success');
    else if(!result.skipped) toast('GitHub sync failed: ' + (result.error || 'unknown error'), 'error');
  });
}
function deleteOrderFromGitHubBackground(trackingId){
  if(!isGithubSyncConfigured()) return;
  deleteOrderFromGitHub(trackingId).then(result => {
    if(!result.ok && !result.skipped) toast('Could not remove order from GitHub: ' + (result.error||''), 'error');
  });
}

/* Push every existing local order to GitHub — used for first-time setup
   or to catch up after working offline. */
async function syncAllOrdersToGitHub(onProgress){
  const orders = getOrders();
  let done = 0, failed = 0;
  for(const order of orders){
    const result = await pushOrderToGitHub(order);
    if(result.ok) done++; else if(!result.skipped) failed++;
    if(onProgress) onProgress(done + failed, orders.length);
  }
  return { done, failed, total: orders.length };
}

async function testGithubConnection(){
  const cfg = resolveGitHubRepoInfo();
  if(!cfg.owner || !cfg.repo) return { ok:false, message:'Owner/Repo could not be determined. Fill them in below.' };
  if(!getGithubToken()) return { ok:false, message:'Please enter a GitHub token first.' };
  try{
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, {
      headers: { Authorization: `Bearer ${getGithubToken()}`, Accept: 'application/vnd.github+json' }
    });
    if(res.status === 404) return { ok:false, message:`Repo "${cfg.owner}/${cfg.repo}" not found, or token can't access it.` };
    if(res.status === 401) return { ok:false, message:'Token is invalid or expired.' };
    if(!res.ok) return { ok:false, message:`GitHub returned an error (${res.status}).` };
    const data = await res.json();
    return { ok:true, message:`Connected to ${data.full_name} (${data.private ? 'private' : 'public'} repo).`, isPrivate: data.private };
  }catch(err){
    return { ok:false, message:'Network error reaching GitHub: ' + err.message };
  }
}
