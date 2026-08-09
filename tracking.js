/* ==========================================================================
   NEXSERVE — tracking.js
   Public, no-login tracking page. Fetches the shared order status from
   GitHub (works on any device) with a LocalStorage fallback for local
   testing before GitHub sync is set up.

   PRIVACY: only a safe subset of order fields is ever rendered here.
   Never render: paymentStatus, paymentMethod, amount, deliveryCharge,
   notes, invoice, vendor/purchase info, or any admin credentials.
   ========================================================================== */

document.getElementById('footYear').textContent = new Date().getFullYear();

function getQueryTrackingId(){
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function doTrack(){
  const id = document.getElementById('trackInput').value.trim();
  if(!id) return;
  const url = new URL(window.location.href);
  url.searchParams.set('id', id);
  window.history.replaceState({}, '', url);
  renderResult(id);
}

function ghRawUrl(trackingId){
  const cfg = resolveGitHubRepoInfo();
  if(!cfg.owner || !cfg.repo) return null;
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.folder}/${encodeURIComponent(trackingId)}.json?t=${Date.now()}`;
}

/* Looks up an order for the tracking page. Tries the shared GitHub copy
   first (works on any device), and falls back to this browser's local
   LocalStorage copy (useful for local testing before GitHub is set up). */
async function fetchOrderForTracking(trackingId){
  const url = ghRawUrl(trackingId);
  if(url){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if(res.ok){
        const data = await res.json();
        return { order: data, source: 'github' };
      }
    }catch(e){ /* network/offline — fall through to local */ }
  }
  const local = getOrderByTrackingId(trackingId);
  return local ? { order: local, source: 'local' } : { order: null, source: null };
}

async function renderResult(trackingId){
  const box = document.getElementById('trackResult');
  const settings = getSettings();
  document.getElementById('companyWebsite').textContent = settings.website;

  if(!trackingId){ box.innerHTML = ''; return; }

  box.innerHTML = `<div class="track-status-card" style="text-align:center;color:var(--text-faint);padding:40px 20px;">Looking up your order…</div>`;
  const { order, source } = await fetchOrderForTracking(trackingId);
  if(!order){
    box.innerHTML = `
      <div class="track-status-card track-not-found">
        ${iconNotFound()}
        <h3 style="font-size:16px;margin-bottom:6px;">We couldn't find that order</h3>
        <p>Please double-check the tracking ID and try again, or contact support below.</p>
        ${supportRow(settings)}
      </div>`;
    return;
  }

  const pct = statusProgressPercent(order.currentStatus);
  const timeline = [...(order.timeline || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
  const lastEvent = timeline[timeline.length - 1];
  const isCancelled = order.currentStatus === 'Cancelled';

  box.innerHTML = `
    <div class="track-status-card">
      <div class="track-id-row">
        <div>
          <div class="kv-label">Tracking ID</div>
          <div class="mono" style="font-size:15px;font-weight:700;">${esc(order.trackingId)}</div>
        </div>
        <div style="text-align:right;">
          <div class="kv-label">Current Status</div>
          <div class="track-status-badge" style="color:${isCancelled ? 'var(--red-500)' : 'var(--teal-500)'}">${order.currentStatus}</div>
        </div>
      </div>

      ${!isCancelled ? `
      <div class="track-progress"><div class="track-progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11.5px;color:var(--text-faint);">${pct}% complete</div>
      ` : ''}

      <div class="track-meta-grid">
        <div class="track-meta-item">${kvBlock('Customer', order.customerName)}</div>
        <div class="track-meta-item">${kvBlock('Product', order.product + (order.model ? ' · ' + order.model : ''))}</div>
        <div class="track-meta-item">${kvBlock('Quantity', order.quantity)}</div>
        <div class="track-meta-item">${kvBlock('Order Date', fmtDate(order.orderDate))}</div>
        <div class="track-meta-item">${kvBlock('Expected Delivery', order.expectedDelivery ? fmtDate(order.expectedDelivery) : 'To be confirmed')}</div>
        <div class="track-meta-item">${kvBlock('Current Location', order.currentLocation || 'Update in progress')}</div>
      </div>

      ${lastEvent ? `<div class="storage-warn" style="background:var(--surface-2);color:var(--text-dim);margin-top:16px;">${iconInfo()}<div><strong>Latest update:</strong> ${esc(lastEvent.note || order.currentStatus)}<br><span style="font-size:11px;">Last updated ${fmtDateTime(order.updatedAt)}</span></div></div>` : ''}

      <div class="form-section-title">Delivery Timeline</div>
      <div class="trace-timeline">
        ${timeline.map((t, idx) => {
          const isLast = idx === timeline.length - 1;
          const cls = isLast ? 'current' : 'done';
          return `
          <div class="trace-step ${cls}">
            <div class="trace-node">${cls==='done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : '<div class="dot"></div>'}</div>
            <div class="trace-title">${t.status}</div>
            <div class="trace-time">${fmtDateTime(t.date)}${t.location ? ' · ' + esc(t.location) : ''}</div>
            ${t.note ? `<div class="trace-note">${esc(t.note)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>

      ${supportRow(settings)}
    </div>
  `;
}

function kvBlock(label, value){
  return `<div class="kv-label">${label}</div><div class="kv-value">${esc(value || '—')}</div>`;
}
function supportRow(settings){
  const waMsg = encodeURIComponent(`Hello, I'd like an update on my order.\n\nTracking ID: ${document.getElementById('trackInput').value.trim() || getQueryTrackingId()}`);
  return `
    <div class="track-support-row">
      <a class="btn btn-whatsapp" href="https://wa.me/${(settings.whatsapp||'').replace(/\D/g,'')}?text=${waMsg}" target="_blank" rel="noopener">
        ${iconWA()} WhatsApp Support
      </a>
      <a class="btn" href="tel:${settings.phone}">${iconCall()} Call Support</a>
    </div>`;
}

function esc(str){
  if(str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function iconNotFound(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>'; }
function iconInfo(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'; }
function iconWA(){ return '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.7 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.5 1.6.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>'; }
function iconCall(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg>'; }

/* Init */
(function init(){
  const id = getQueryTrackingId();
  if(id){
    document.getElementById('trackInput').value = id;
    renderResult(id);
  }
  document.getElementById('trackInput').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') doTrack();
  });
})();
