/* ==========================================================================
   NEXSERVE — app.js  (Admin dashboard logic)
   ========================================================================== */

const AUTH = {
  USERNAME: 'admin',
  PASSWORD: 'Nexserve#8341' // NOTE: demo-only credential. Never shown in the UI.
};

let STATE = {
  view: 'dashboard',
  search: '',
  filter: 'All',
  activeOrderId: null,
  invoiceDraft: null // { dataUrl, fileName, fileType }
};

/* ---------------------------------------------------------------------- */
/* AUTH                                                                     */
/* ---------------------------------------------------------------------- */
function isLoggedIn(){
  return sessionStorage.getItem('nexserve_session') === '1' ||
         localStorage.getItem('nexserve_session') === '1';
}
function login(username, password, remember){
  if(username === AUTH.USERNAME && password === AUTH.PASSWORD){
    if(remember){ localStorage.setItem('nexserve_session', '1'); }
    else { sessionStorage.setItem('nexserve_session', '1'); }
    return true;
  }
  return false;
}
function logout(){
  sessionStorage.removeItem('nexserve_session');
  localStorage.removeItem('nexserve_session');
  renderAuthGate();
}

function renderAuthGate(){
  const loginEl = document.getElementById('loginScreen');
  const appEl = document.getElementById('appShell');
  if(isLoggedIn()){
    loginEl.classList.add('hidden');
    appEl.classList.remove('hidden');
    seedDemoDataIfNeeded();
    navigate('dashboard');
  }else{
    appEl.classList.add('hidden');
    loginEl.classList.remove('hidden');
  }
}

function setupLoginForm(){
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    const remember = document.getElementById('loginRemember').checked;
    const errBox = document.getElementById('loginError');
    if(login(u, p, remember)){
      errBox.classList.add('hidden');
      form.reset();
      renderAuthGate();
    }else{
      errBox.textContent = 'Incorrect username or password. Please try again.';
      errBox.classList.remove('hidden');
    }
  });
}

/* ---------------------------------------------------------------------- */
/* TOASTS                                                                   */
/* ---------------------------------------------------------------------- */
function toast(message, type='info'){
  const stack = document.getElementById('toastStack');
  const icons = {
    success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 250); }, 3800);
}

/* ---------------------------------------------------------------------- */
/* NAVIGATION / SIDEBAR                                                     */
/* ---------------------------------------------------------------------- */
function navigate(view){
  STATE.view = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.getElementById('topbarTitle').textContent = VIEW_TITLES[view] || 'Dashboard';
  document.getElementById('topbarSub').textContent = VIEW_SUBS[view] || '';
  closeSidebarMobile();
  renderView(view);
}

const VIEW_TITLES = {
  dashboard:'Dashboard', orders:'Orders', tracking:'Tracking Lookup', customers:'Customers',
  reports:'Reports', backup:'Backup & Restore', settings:'Settings'
};
const VIEW_SUBS = {
  dashboard:"Here's what's happening with your orders today.",
  orders:'Search, filter and manage every order.',
  tracking:'Look up any order by tracking ID.',
  customers:'All customers who have placed an order.',
  reports:'Business performance at a glance.',
  backup:'Keep your data safe — export regularly.',
  settings:'Update company details used across the app.'
};

function renderView(view){
  const content = document.getElementById('content');
  if(view === 'dashboard') content.innerHTML = renderDashboard();
  else if(view === 'orders') content.innerHTML = renderOrdersView();
  else if(view === 'tracking') content.innerHTML = renderTrackingLookupView();
  else if(view === 'customers') content.innerHTML = renderCustomersView();
  else if(view === 'reports') content.innerHTML = renderReportsView();
  else if(view === 'backup') content.innerHTML = renderBackupView();
  else if(view === 'settings') content.innerHTML = renderSettingsView();
  wireViewEvents(view);
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarBackdrop').classList.toggle('show'); }
function closeSidebarMobile(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('show'); }

/* ---------------------------------------------------------------------- */
/* DASHBOARD                                                                */
/* ---------------------------------------------------------------------- */
function renderDashboard(){
  const orders = getOrders();
  const counts = {
    total: orders.length,
    pending: orders.filter(o => !['Delivered','Cancelled'].includes(o.currentStatus)).length,
    processing: orders.filter(o => o.currentStatus === 'Processing').length,
    ready: orders.filter(o => o.currentStatus === 'Ready for Dispatch').length,
    dispatched: orders.filter(o => o.currentStatus === 'Dispatched').length,
    outfordelivery: orders.filter(o => o.currentStatus === 'Out for Delivery').length,
    delivered: orders.filter(o => o.currentStatus === 'Delivered').length,
    cancelled: orders.filter(o => o.currentStatus === 'Cancelled').length
  };
  const todayStr = new Date().toDateString();
  const todaysOrders = orders.filter(o => new Date(o.orderDate).toDateString() === todayStr);
  const recent = [...orders].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);
  const upcoming = orders
    .filter(o => o.expectedDelivery && !['Delivered','Cancelled'].includes(o.currentStatus))
    .sort((a,b) => new Date(a.expectedDelivery) - new Date(b.expectedDelivery))
    .slice(0, 6);

  const cards = [
    ['total','Total Orders', counts.total, iconBox(), 'var(--indigo-500)','rgba(99,102,241,0.12)'],
    ['pending','Pending Orders', counts.pending, iconClock(), 'var(--amber-500)','var(--amber-100)'],
    ['processing','Processing', counts.processing, iconLoader(), 'var(--blue-600)','var(--blue-100)'],
    ['ready','Ready for Dispatch', counts.ready, iconPackage(), 'var(--amber-500)','var(--amber-100)'],
    ['dispatched','Dispatched', counts.dispatched, iconTruck(), 'var(--indigo-500)','rgba(99,102,241,0.12)'],
    ['outfordelivery','Out for Delivery', counts.outfordelivery, iconTruck(), 'var(--teal-500)','rgba(20,184,166,0.12)'],
    ['delivered','Delivered', counts.delivered, iconCheckCircle(), 'var(--green-500)','var(--green-100)'],
    ['cancelled','Cancelled', counts.cancelled, iconX(), 'var(--red-500)','var(--red-100)'],
  ];

  return `
    <div class="toolbar" style="margin-bottom:18px;">
      <div></div>
      <button class="btn btn-accent btn-lg" onclick="openOrderModal()">${iconPlus()} Create New Order</button>
    </div>
    <div class="stat-grid">
      ${cards.map(([key,label,val,icon,accent,accentBg]) => `
        <div class="stat-card" style="--card-accent:${accent};--card-accent-bg:${accentBg}">
          <div class="stat-icon">${icon}</div>
          <div class="stat-value">${val}</div>
          <div class="stat-label">${label}</div>
        </div>`).join('')}
    </div>

    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h3>Recent Orders</h3><button class="btn btn-sm" onclick="navigate('orders')">View all</button></div>
        <div class="panel-body">
          ${recent.length ? recent.map(o => `
            <div class="mini-row">
              <div class="mini-row-main">
                <span class="mini-row-name">${esc(o.customerName)} · <span class="mono cell-track">${o.trackingId}</span></span>
                <span class="mini-row-sub">${esc(o.product)} · Updated ${fmtDateTime(o.updatedAt)}</span>
              </div>
              <span class="badge ${badgeClassFor(o.currentStatus)}">${o.currentStatus}</span>
            </div>`).join('') : emptyState('No orders yet', 'Create your first order to see it here.')}
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-head"><h3>Today's Orders</h3></div>
          <div class="panel-body">
            ${todaysOrders.length ? todaysOrders.map(o => `
              <div class="mini-row">
                <div class="mini-row-main">
                  <span class="mini-row-name">${esc(o.customerName)}</span>
                  <span class="mini-row-sub mono">${o.trackingId}</span>
                </div>
                <span class="badge ${badgeClassFor(o.currentStatus)}">${o.currentStatus}</span>
              </div>`).join('') : emptyState('No orders today', 'New orders placed today will show up here.')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Upcoming Deliveries</h3></div>
          <div class="panel-body">
            ${upcoming.length ? upcoming.map(o => `
              <div class="mini-row">
                <div class="mini-row-main">
                  <span class="mini-row-name">${esc(o.customerName)}</span>
                  <span class="mini-row-sub">Expected ${fmtDate(o.expectedDelivery)}</span>
                </div>
                <span class="badge ${badgeClassFor(o.currentStatus)}">${o.currentStatus}</span>
              </div>`).join('') : emptyState('Nothing upcoming', 'Orders with an expected delivery date appear here.')}
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* ORDERS LIST / SEARCH / FILTER                                            */
/* ---------------------------------------------------------------------- */
const FILTER_GROUPS = {
  All: null,
  Pending: ['Order Received','Order Confirmed','Payment Confirmed'],
  Processing: ['Processing','Product Testing','Packing'],
  Dispatched: ['Ready for Dispatch','Dispatched','In Transit'],
  'Out for Delivery': ['Out for Delivery'],
  Delivered: ['Delivered'],
  Cancelled: ['Cancelled']
};

function getFilteredOrders(){
  let orders = getOrders();
  const q = STATE.search.trim().toLowerCase();
  if(q){
    orders = orders.filter(o =>
      (o.customerName||'').toLowerCase().includes(q) ||
      (o.mobile||'').includes(q) ||
      (o.orderId||'').toLowerCase().includes(q) ||
      (o.trackingId||'').toLowerCase().includes(q) ||
      (o.product||'').toLowerCase().includes(q) ||
      (o.currentStatus||'').toLowerCase().includes(q)
    );
  }
  const group = FILTER_GROUPS[STATE.filter];
  if(group) orders = orders.filter(o => group.includes(o.currentStatus));
  return orders;
}

function renderOrdersView(){
  const orders = getFilteredOrders();
  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          ${iconSearch()}
          <input type="text" id="orderSearchInput" placeholder="Search name, mobile, order ID, tracking ID..." value="${esc(STATE.search)}">
        </div>
        <div class="chip-filters" id="filterChips">
          ${Object.keys(FILTER_GROUPS).map(f => `<button class="chip-filter ${STATE.filter===f?'active':''}" data-filter="${f}">${f}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-accent" onclick="openOrderModal()">${iconPlus()} Create New Order</button>
    </div>
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Customer</th><th>Tracking ID</th><th>Product</th><th>Amount</th><th>Payment</th><th>Status</th><th>Expected</th><th></th>
          </tr></thead>
          <tbody>
            ${orders.length ? orders.map(o => `
              <tr onclick="openOrderDetail('${o.id}')">
                <td><div class="cell-name">${esc(o.customerName)}</div><div class="cell-sub">${esc(o.mobile)}</div></td>
                <td><span class="cell-track">${o.trackingId}</span>${o.isDemo?'<span class="badge badge-demo" style="margin-left:6px;">Demo</span>':''}</td>
                <td>${esc(o.product)}${o.model?` · ${esc(o.model)}`:''}</td>
                <td>${fmtCurrency(o.amount)}</td>
                <td><span class="badge ${paymentBadgeClass(o.paymentStatus)}">${o.paymentStatus||'Unpaid'}</span></td>
                <td><span class="badge ${badgeClassFor(o.currentStatus)}">${o.currentStatus}</span></td>
                <td>${fmtDate(o.expectedDelivery)}</td>
                <td onclick="event.stopPropagation()">
                  <div class="row-actions">
                    <button title="View" onclick="openOrderDetail('${o.id}')">${iconEye()}</button>
                    <button title="Edit" onclick="openOrderModal('${o.id}')">${iconEdit()}</button>
                    <button title="Delete" onclick="confirmDeleteOrder('${o.id}')">${iconTrash()}</button>
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="8">${emptyState('No matching orders', 'Try a different search term or filter.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function wireOrdersToolbar(){
  const input = document.getElementById('orderSearchInput');
  if(input){
    input.addEventListener('input', (e) => {
      STATE.search = e.target.value;
      document.getElementById('content').innerHTML = renderOrdersView();
      wireOrdersToolbar();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
  document.querySelectorAll('.chip-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.filter = btn.dataset.filter;
      document.getElementById('content').innerHTML = renderOrdersView();
      wireOrdersToolbar();
    });
  });
}

/* ---------------------------------------------------------------------- */
/* TRACKING LOOKUP (admin quick-lookup) & CUSTOMERS                        */
/* ---------------------------------------------------------------------- */
function renderTrackingLookupView(){
  return `
    <div class="panel">
      <div class="panel-body">
        <div class="field" style="max-width:420px;">
          <label>Enter a tracking ID</label>
          <input type="text" id="adminTrackLookup" placeholder="e.g. NXS-2026-0001" class="mono" style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;width:100%;">
        </div>
        <button class="btn btn-accent" onclick="adminLookupTracking()">${iconSearch()} Look up order</button>
        <div id="adminTrackResult" style="margin-top:18px;"></div>
      </div>
    </div>
  `;
}
function adminLookupTracking(){
  const val = document.getElementById('adminTrackLookup').value;
  const order = getOrderByTrackingId(val);
  const box = document.getElementById('adminTrackResult');
  if(!order){
    box.innerHTML = emptyState('No order found', `No order matches tracking ID "${esc(val)}".`);
    return;
  }
  box.innerHTML = `<div class="mini-row"><div class="mini-row-main"><span class="mini-row-name">${esc(order.customerName)} · <span class="mono cell-track">${order.trackingId}</span></span><span class="mini-row-sub">${esc(order.product)}</span></div><button class="btn btn-sm btn-accent" onclick="openOrderDetail('${order.id}')">Open</button></div>`;
}

function renderCustomersView(){
  const orders = getOrders();
  const map = {};
  orders.forEach(o => {
    const key = (o.mobile || o.customerName || '').trim();
    if(!map[key]) map[key] = { name:o.customerName, mobile:o.mobile, email:o.email, city:o.city, orders:[] };
    map[key].orders.push(o);
  });
  const customers = Object.values(map).sort((a,b) => b.orders.length - a.orders.length);
  return `
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Customer</th><th>Mobile</th><th>Email</th><th>City</th><th>Orders</th><th>Last Order</th></tr></thead>
          <tbody>
            ${customers.length ? customers.map(c => {
              const last = [...c.orders].sort((a,b) => new Date(b.orderDate)-new Date(a.orderDate))[0];
              return `<tr onclick="openOrderDetail('${last.id}')">
                <td class="cell-name">${esc(c.name)}</td>
                <td>${esc(c.mobile||'—')}</td>
                <td>${esc(c.email||'—')}</td>
                <td>${esc(c.city||'—')}</td>
                <td>${c.orders.length}</td>
                <td>${fmtDate(last.orderDate)}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="6">${emptyState('No customers yet','Customers appear automatically once you create orders.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* REPORTS                                                                  */
/* ---------------------------------------------------------------------- */
function renderReportsView(){
  const orders = getOrders();
  const total = orders.length;
  const delivered = orders.filter(o => o.currentStatus === 'Delivered').length;
  const pending = orders.filter(o => !['Delivered','Cancelled'].includes(o.currentStatus)).length;
  const cancelled = orders.filter(o => o.currentStatus === 'Cancelled').length;
  const totalSales = orders.filter(o=>o.currentStatus!=='Cancelled').reduce((s,o) => s + (Number(o.amount)||0), 0);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const ordersThisMonth = orders.filter(o => new Date(o.orderDate) >= startOfMonth).length;
  const ordersThisWeek = orders.filter(o => new Date(o.orderDate) >= startOfWeek).length;

  const productMap = {};
  orders.forEach(o => { productMap[o.product] = (productMap[o.product]||0) + (Number(o.quantity)||1); });
  const topProducts = Object.entries(productMap).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxProd = Math.max(1, ...topProducts.map(p => p[1]));

  return `
    <div class="report-grid" style="margin-bottom:20px;">
      ${statCardSimple('Total Orders', total, 'var(--indigo-500)')}
      ${statCardSimple('Delivered', delivered, 'var(--green-500)')}
      ${statCardSimple('Pending', pending, 'var(--amber-500)')}
      ${statCardSimple('Cancelled', cancelled, 'var(--red-500)')}
      ${statCardSimple('Orders This Month', ordersThisMonth, 'var(--teal-500)')}
      ${statCardSimple('Orders This Week', ordersThisWeek, 'var(--teal-500)')}
    </div>
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h3>Top Products</h3></div>
        <div class="panel-body">
          ${topProducts.length ? topProducts.map(([name,qty]) => `
            <div class="bar-row">
              <div class="bar-label">${esc(name)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${(qty/maxProd*100)}%"></div></div>
              <div class="bar-val">${qty}</div>
            </div>`).join('') : emptyState('No product data yet','')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Total Sales Value</h3></div>
        <div class="panel-body">
          <div class="stat-value" style="font-size:32px;">${fmtCurrency(totalSales)}</div>
          <div class="stat-label" style="margin-top:8px;">Admin-only figure — excluded from the customer tracking page.</div>
        </div>
      </div>
    </div>
  `;
}
function statCardSimple(label, val, accent){
  return `<div class="stat-card" style="--card-accent:${accent}"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`;
}

/* ---------------------------------------------------------------------- */
/* BACKUP & RESTORE                                                         */
/* ---------------------------------------------------------------------- */
function renderBackupView(){
  const last = getLastBackupDate();
  return `
    <div class="panel">
      <div class="panel-body">
        <div class="storage-warn" style="margin-bottom:18px;">
          ${iconAlert()}
          <div>Local browser storage is being used to store all order data. It can be lost if browser data is cleared, or is not shared between devices/browsers. Regularly export your backup to keep your data safe.</div>
        </div>
        <p class="mini-row-sub" style="margin-bottom:14px;">Last backup: <strong>${last ? fmtDateTime(last) : 'Never'}</strong></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px;">
          <button class="btn btn-accent" onclick="doExportBackup()">${iconDownload()} Backup Now</button>
          <button class="btn" onclick="doExportCSV()">${iconDownload()} Export CSV</button>
        </div>
        <div class="form-section-title">Restore from backup</div>
        <p class="mini-row-sub" style="margin-bottom:10px;">Restoring will replace all current order data with the contents of the JSON backup file.</p>
        <input type="file" id="restoreFileInput" accept="application/json" class="btn" style="padding:9px;">
        <button class="btn btn-indigo" style="margin-left:8px;" onclick="doImportBackup()">${iconUpload()} Restore Data</button>
      </div>
    </div>
  `;
}
function doExportBackup(){ exportBackup(); toast('Backup downloaded successfully.', 'success'); renderView('backup'); }
function doExportCSV(){ exportCSV(); toast('CSV exported successfully.', 'success'); }
function doImportBackup(){
  const input = document.getElementById('restoreFileInput');
  const file = input.files[0];
  if(!file){ toast('Please choose a backup JSON file first.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = importBackup(e.target.result);
    toast(result.message, result.ok ? 'success' : 'error');
    if(result.ok) navigate('dashboard');
  };
  reader.onerror = () => toast('Could not read the selected file.', 'error');
  reader.readAsText(file);
}

/* ---------------------------------------------------------------------- */
/* SETTINGS                                                                  */
/* ---------------------------------------------------------------------- */
function renderSettingsView(){
  const s = getSettings();
  return `
    <div class="panel">
      <div class="panel-body">
        <form id="settingsForm">
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input name="companyName" value="${esc(s.companyName)}" required></div>
            <div class="field"><label>Phone</label><input name="phone" value="${esc(s.phone)}" required></div>
            <div class="field"><label>Email</label><input name="email" type="email" value="${esc(s.email)}" required></div>
            <div class="field"><label>Website</label><input name="website" value="${esc(s.website)}"></div>
            <div class="field"><label>WhatsApp Number (with country code)</label><input name="whatsapp" value="${esc(s.whatsapp)}"></div>
            <div class="field span-2"><label>Default Delivery Message</label><textarea name="defaultDeliveryMsg" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">${esc(s.defaultDeliveryMsg)}</textarea></div>
            <div class="field span-2"><label>Default Expected Delivery Text</label><textarea name="defaultExpectedText" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">${esc(s.defaultExpectedText)}</textarea></div>
          </div>
          <button type="submit" class="btn btn-accent" style="margin-top:18px;">Save Settings</button>
        </form>
      </div>
    </div>
  `;
}
function wireSettingsForm(){
  const form = document.getElementById('settingsForm');
  if(!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const settings = Object.fromEntries(fd.entries());
    saveSettings(settings);
    toast('Settings saved.', 'success');
  });
}

/* ---------------------------------------------------------------------- */
/* Wire per-view events                                                     */
/* ---------------------------------------------------------------------- */
function wireViewEvents(view){
  if(view === 'orders') wireOrdersToolbar();
  if(view === 'settings') wireSettingsForm();
}

/* ---------------------------------------------------------------------- */
/* SMALL HELPERS: icons, escaping, empty states                             */
/* ---------------------------------------------------------------------- */
function esc(str){
  if(str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function emptyState(title, sub){
  return `<div class="empty-state">${iconInbox()}<p style="font-weight:600;color:var(--text-dim);">${title}</p><p>${sub||''}</p></div>`;
}
function iconPlus(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'; }
function iconSearch(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'; }
function iconEye(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function iconEdit(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function iconTrash(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'; }
function iconBox(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>'; }
function iconClock(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'; }
function iconLoader(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>'; }
function iconPackage(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9"/></svg>'; }
function iconTruck(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg>'; }
function iconCheckCircle(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>'; }
function iconX(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>'; }
function iconInbox(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v7H2v-7l3.5-7Z"/></svg>'; }
function iconAlert(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'; }
function iconDownload(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/></svg>'; }
function iconUpload(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9m0 0 4 4m-4-4-4 4"/><path d="M4 4h16"/></svg>'; }
function iconFile(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'; }
function iconWhatsapp(){ return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.7 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.5 1.6.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>'; }
