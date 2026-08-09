/* ==========================================================================
   NEXSERVE — orders-ui.js
   Create/Edit order modal, order detail modal, status updates, WhatsApp.
   ========================================================================== */

const PAYMENT_METHODS = ['UPI','Cash','Card','Bank Transfer','Cheque','EMI'];
const DELIVERY_METHODS = ['Courier','Self Pickup','Local Delivery','Speed Post'];
const PAYMENT_STATUSES = ['Unpaid','Partial','Paid'];

function closeModal(){
  const overlay = document.getElementById('modalRoot');
  overlay.innerHTML = '';
  overlay.classList.add('hidden');
  document.body.classList.remove('scr-lock');
  STATE.invoiceDraft = null;
}
function mountModal(html){
  const overlay = document.getElementById('modalRoot');
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
  document.body.classList.add('scr-lock');
  overlay.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if(e.target.classList.contains('modal-overlay')) closeModal();
  });
}

/* ---------------------------------------------------------------------- */
/* CREATE / EDIT ORDER MODAL                                                */
/* ---------------------------------------------------------------------- */
function openOrderModal(orderId){
  const editing = !!orderId;
  const order = editing ? getOrderById(orderId) : null;
  const trackingId = editing ? order.trackingId : generateTrackingId();
  const orderIdVal = editing ? order.orderId : ('ORD-' + Date.now().toString().slice(-6));
  STATE.invoiceDraft = editing && order.invoice ? { dataUrl: order.invoice, fileName: order.invoiceFileName } : null;

  const o = order || {};
  mountModal(`
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h3>${editing ? 'Edit Order' : 'Create New Order'}</h3>
          <button class="modal-close" onclick="closeModal()">${iconX()}</button>
        </div>
        <div class="modal-body">
          <form id="orderForm">
            <input type="hidden" name="_id" value="${editing ? order.id : ''}">

            <div class="form-section-title">Customer Information</div>
            <div class="form-grid">
              <div class="field"><label>Customer Name *</label><input name="customerName" required value="${esc(o.customerName)}"></div>
              <div class="field"><label>Mobile Number *</label><input name="mobile" required value="${esc(o.mobile)}" placeholder="10-digit mobile number"></div>
              <div class="field"><label>WhatsApp Number</label><input name="whatsapp" value="${esc(o.whatsapp)}" placeholder="Leave blank to use mobile number"></div>
              <div class="field"><label>Email</label><input name="email" type="email" value="${esc(o.email)}"></div>
              <div class="field span-2"><label>Address</label><input name="address" value="${esc(o.address)}"></div>
              <div class="field"><label>City</label><input name="city" value="${esc(o.city)}"></div>
              <div class="field"><label>State</label><input name="state" value="${esc(o.state)}"></div>
              <div class="field"><label>Pincode</label><input name="pincode" value="${esc(o.pincode)}"></div>
            </div>

            <div class="form-section-title">Order Information</div>
            <div class="form-grid">
              <div class="field"><label>Order ID</label><input name="orderId" value="${esc(orderIdVal)}" readonly style="background:var(--surface-2);"></div>
              <div class="field"><label>Tracking ID</label><input name="trackingId" class="mono" value="${esc(trackingId)}" readonly style="background:var(--surface-2);"></div>
              <div class="field"><label>Order Date *</label><input type="date" name="orderDate" required value="${(o.orderDate ? new Date(o.orderDate) : new Date()).toISOString().slice(0,10)}"></div>
              <div class="field"><label>Expected Delivery Date</label><input type="date" name="expectedDelivery" value="${o.expectedDelivery ? new Date(o.expectedDelivery).toISOString().slice(0,10) : ''}"></div>
              <div class="field"><label>Product *</label><input name="product" required value="${esc(o.product)}"></div>
              <div class="field"><label>Model</label><input name="model" value="${esc(o.model)}"></div>
              <div class="field"><label>Quantity *</label><input type="number" min="1" name="quantity" required value="${o.quantity||1}"></div>
              <div class="field"><label>Selling Price (₹) *</label><input type="number" min="0" name="amount" required value="${o.amount!==undefined?o.amount:''}"></div>
              <div class="field"><label>Payment Status</label>
                <select name="paymentStatus">${PAYMENT_STATUSES.map(s=>`<option ${o.paymentStatus===s?'selected':''}>${s}</option>`).join('')}</select>
              </div>
              <div class="field"><label>Payment Method</label>
                <select name="paymentMethod">${PAYMENT_METHODS.map(s=>`<option ${o.paymentMethod===s?'selected':''}>${s}</option>`).join('')}</select>
              </div>
              <div class="field"><label>Delivery Method</label>
                <select name="deliveryMethod">${DELIVERY_METHODS.map(s=>`<option ${o.deliveryMethod===s?'selected':''}>${s}</option>`).join('')}</select>
              </div>
              <div class="field"><label>Delivery Charge (₹)</label><input type="number" min="0" name="deliveryCharge" value="${o.deliveryCharge||0}"></div>
              <div class="field span-2"><label>Notes (internal only — never shown to customer)</label><textarea name="notes" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">${esc(o.notes)}</textarea></div>
            </div>

            <div class="form-section-title">Bill / Invoice Upload</div>
            <div id="invoiceArea"></div>
            <p class="mini-row-sub" style="margin-top:6px;">Accepted formats: PDF, JPG, JPEG, PNG.</p>
            <div class="storage-warn">${iconAlert()} Invoices are stored in this browser's LocalStorage as Base64 data. Large or many files may fill up available storage — export backups regularly.</div>

          </form>
        </div>
        <div class="modal-foot">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-accent" onclick="submitOrderForm(${editing ? `'${order.id}'` : 'null'})">${editing ? 'Save Changes' : 'Create Order'}</button>
        </div>
      </div>
    </div>
  `);
  renderInvoiceArea();
}

function renderInvoiceArea(){
  const area = document.getElementById('invoiceArea');
  if(!area) return;
  if(STATE.invoiceDraft){
    area.innerHTML = `
      <div class="file-preview">
        <div class="file-preview-icon">${iconFile()}</div>
        <div class="file-preview-name">${esc(STATE.invoiceDraft.fileName)}</div>
        <button type="button" class="btn btn-sm" onclick="viewInvoiceDraft()">View</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="clearInvoiceDraft()">Remove</button>
      </div>`;
  }else{
    area.innerHTML = `
      <label class="file-drop" for="invoiceInput">
        ${iconUpload()}
        <div style="font-weight:600;font-size:13px;">Click to upload invoice/bill</div>
        <div class="mini-row-sub">PDF, JPG, JPEG or PNG</div>
      </label>
      <input type="file" id="invoiceInput" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf" class="hidden" onchange="handleInvoiceUpload(event)">`;
  }
}
function handleInvoiceUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const allowed = ['application/pdf','image/jpeg','image/jpg','image/png'];
  if(!allowed.includes(file.type)){
    toast('Invalid file type. Please upload a PDF, JPG, JPEG or PNG file.', 'error');
    return;
  }
  if(file.size > 4 * 1024 * 1024){
    toast('File is larger than 4MB — LocalStorage has limited space. Please use a smaller file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    STATE.invoiceDraft = { dataUrl: ev.target.result, fileName: file.name, fileType: file.type };
    renderInvoiceArea();
  };
  reader.onerror = () => toast('Could not read the selected file.', 'error');
  reader.readAsDataURL(file);
}
function clearInvoiceDraft(){ STATE.invoiceDraft = null; renderInvoiceArea(); }
function viewInvoiceDraft(){
  if(!STATE.invoiceDraft) return;
  const w = window.open();
  if(STATE.invoiceDraft.fileType === 'application/pdf' || STATE.invoiceDraft.dataUrl.startsWith('data:application/pdf')){
    w.document.write(`<iframe src="${STATE.invoiceDraft.dataUrl}" style="border:0;width:100%;height:100vh;"></iframe>`);
  }else{
    w.document.write(`<img src="${STATE.invoiceDraft.dataUrl}" style="max-width:100%;">`);
  }
}

function clearFieldErrors(form){
  form.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
}
function markFieldError(form, name, msg){
  const input = form.querySelector(`[name="${name}"]`);
  if(!input) return;
  const field = input.closest('.field');
  field.classList.add('error');
  let small = field.querySelector('.field-error');
  if(!small){
    small = document.createElement('small');
    small.className = 'field-error';
    field.appendChild(small);
  }
  small.textContent = msg;
}

function submitOrderForm(existingId){
  const form = document.getElementById('orderForm');
  clearFieldErrors(form);
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  let hasError = false;

  if(!data.customerName.trim()){ markFieldError(form,'customerName','Customer name is required.'); hasError = true; }
  if(!/^\d{10}$/.test(data.mobile.replace(/\D/g,''))){ markFieldError(form,'mobile','Enter a valid 10-digit mobile number.'); hasError = true; }
  if(data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){ markFieldError(form,'email','Enter a valid email address.'); hasError = true; }
  if(!data.product.trim()){ markFieldError(form,'product','Product is required.'); hasError = true; }
  if(!data.quantity || Number(data.quantity) < 1){ markFieldError(form,'quantity','Quantity must be at least 1.'); hasError = true; }
  if(data.amount === '' || Number(data.amount) < 0){ markFieldError(form,'amount','Enter a valid selling price.'); hasError = true; }
  if(!data.orderDate){ markFieldError(form,'orderDate','Order date is required.'); hasError = true; }
  if(isTrackingIdTaken(data.trackingId, existingId)){ toast('This tracking ID already exists. Please refresh and try again.', 'error'); hasError = true; }
  if(!existingId && !STATE.invoiceDraft){
    // Bill upload is encouraged but not force-blocked, to avoid trapping the admin — warn instead.
  }

  if(hasError){ toast('Please fix the highlighted fields.', 'error'); return; }

  const payload = {
    customerName: data.customerName.trim(),
    mobile: data.mobile.trim(),
    whatsapp: (data.whatsapp || data.mobile).trim(),
    email: data.email.trim(),
    address: data.address.trim(),
    city: data.city.trim(),
    state: data.state.trim(),
    pincode: data.pincode.trim(),
    orderId: data.orderId,
    trackingId: data.trackingId,
    orderDate: new Date(data.orderDate).toISOString(),
    expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery).toISOString() : '',
    product: data.product.trim(),
    model: data.model.trim(),
    quantity: Number(data.quantity),
    amount: Number(data.amount),
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    deliveryMethod: data.deliveryMethod,
    deliveryCharge: Number(data.deliveryCharge || 0),
    notes: data.notes.trim(),
    invoice: STATE.invoiceDraft ? STATE.invoiceDraft.dataUrl : (existingId ? (getOrderById(existingId)||{}).invoice : null),
    invoiceFileName: STATE.invoiceDraft ? STATE.invoiceDraft.fileName : (existingId ? (getOrderById(existingId)||{}).invoiceFileName : null),
  };

  if(existingId){
    const updated = updateOrder(existingId, payload);
    if(!updated){ toast('Could not save changes — local storage may be full.', 'error'); return; }
    toast('Order updated successfully.', 'success');
    closeModal();
    if(STATE.view === 'orders') renderView('orders'); else renderView(STATE.view);
    if(document.getElementById('orderDetailRoot')) openOrderDetail(existingId);
  }else{
    payload.currentStatus = 'Order Received';
    payload.currentLocation = '';
    payload.latestUpdate = 'Order received and confirmed in system.';
    const created = saveOrder(payload);
    if(!created){ toast('Could not save order — local storage may be full. Try removing an old invoice or exporting + clearing data.', 'error'); return; }
    toast(`Order created — Tracking ID ${created.trackingId}`, 'success');
    closeModal();
    renderView(STATE.view === 'dashboard' || STATE.view === 'orders' ? STATE.view : 'orders');
    openOrderDetail(created.id);
  }
}

function confirmDeleteOrder(id){
  const order = getOrderById(id);
  if(!order) return;
  mountModal(`
    <div class="modal-overlay">
      <div class="modal" style="max-width:420px;">
        <div class="modal-head"><h3>Delete Order</h3><button class="modal-close" onclick="closeModal()">${iconX()}</button></div>
        <div class="modal-body">
          <p>Are you sure you want to delete the order for <strong>${esc(order.customerName)}</strong> (<span class="mono">${order.trackingId}</span>)? This cannot be undone.</p>
        </div>
        <div class="modal-foot">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-danger" onclick="doDeleteOrder('${id}')">Delete Order</button>
        </div>
      </div>
    </div>
  `);
}
function doDeleteOrder(id){
  deleteOrder(id);
  closeModal();
  toast('Order deleted.', 'success');
  renderView(STATE.view === 'dashboard' ? 'dashboard' : 'orders');
}

/* ---------------------------------------------------------------------- */
/* ORDER DETAIL MODAL                                                       */
/* ---------------------------------------------------------------------- */
let DETAIL_TAB = 'overview';

function openOrderDetail(id){
  DETAIL_TAB = 'overview';
  const order = getOrderById(id);
  if(!order){ toast('Order not found.', 'error'); return; }
  STATE.activeOrderId = id;
  mountModal(renderOrderDetailModal(order));
}

function renderOrderDetailModal(order){
  return `
    <div class="modal-overlay">
      <div class="modal modal-lg" id="orderDetailRoot">
        <div class="modal-head">
          <div>
            <h3>${esc(order.customerName)} <span style="font-weight:400;color:var(--text-faint);">· <span class="mono">${order.trackingId}</span></span></h3>
          </div>
          <button class="modal-close" onclick="closeModal()">${iconX()}</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
            <span class="badge ${badgeClassFor(order.currentStatus)}" style="font-size:13px;padding:6px 13px;">${order.currentStatus}</span>
            <span class="badge ${paymentBadgeClass(order.paymentStatus)}">${order.paymentStatus||'Unpaid'}</span>
            ${order.isDemo ? '<span class="badge badge-demo">Demo Order</span>' : ''}
          </div>
          <div class="detail-tabs">
            <button class="detail-tab ${DETAIL_TAB==='overview'?'active':''}" data-tab="overview" onclick="switchDetailTab('overview')">Overview</button>
            <button class="detail-tab ${DETAIL_TAB==='timeline'?'active':''}" data-tab="timeline" onclick="switchDetailTab('timeline')">Timeline</button>
            <button class="detail-tab ${DETAIL_TAB==='status'?'active':''}" data-tab="status" onclick="switchDetailTab('status')">Update Status</button>
            <button class="detail-tab ${DETAIL_TAB==='invoice'?'active':''}" data-tab="invoice" onclick="switchDetailTab('invoice')">Invoice</button>
          </div>
          <div id="detailTabBody">${renderDetailTabBody(order)}</div>
          <div class="detail-actions">
            <button class="btn btn-accent" onclick="openOrderModal('${order.id}')">${iconEdit()} Edit Order</button>
            <button class="btn btn-whatsapp" onclick="sendTrackingLinkWhatsApp('${order.id}')">${iconWhatsapp()} Send Tracking Link</button>
            <button class="btn" onclick="copyTrackingLink('${order.id}')">Copy Tracking Link</button>
            <button class="btn" onclick="printOrder('${order.id}')">Print Order</button>
            ${order.invoice ? `<button class="btn" onclick="downloadInvoice('${order.id}')">Download Invoice</button>` : ''}
            <button class="btn btn-danger" onclick="confirmDeleteOrder('${order.id}')">${iconTrash()} Delete Order</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchDetailTab(tab){
  DETAIL_TAB = tab;
  const order = getOrderById(STATE.activeOrderId);
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('detailTabBody').innerHTML = renderDetailTabBody(order);
}

function renderDetailTabBody(order){
  if(DETAIL_TAB === 'overview') return renderOverviewTab(order);
  if(DETAIL_TAB === 'timeline') return renderTimelineTab(order);
  if(DETAIL_TAB === 'status') return renderStatusTab(order);
  if(DETAIL_TAB === 'invoice') return renderInvoiceTab(order);
  return '';
}

function renderOverviewTab(order){
  return `
    <div class="form-section-title" style="margin-top:0;">Customer</div>
    <div class="detail-grid">
      ${kv('Name', order.customerName)}
      ${kv('Mobile', order.mobile)}
      ${kv('WhatsApp', order.whatsapp)}
      ${kv('Email', order.email)}
      ${kv('Address', [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', '))}
    </div>
    <div class="form-section-title">Order</div>
    <div class="detail-grid">
      ${kv('Order ID', order.orderId)}
      ${kv('Tracking ID', order.trackingId)}
      ${kv('Product', order.product + (order.model ? ' · ' + order.model : ''))}
      ${kv('Quantity', order.quantity)}
      ${kv('Amount', fmtCurrency(order.amount))}
      ${kv('Payment Status', order.paymentStatus)}
      ${kv('Payment Method', order.paymentMethod)}
      ${kv('Order Date', fmtDate(order.orderDate))}
    </div>
    <div class="form-section-title">Delivery</div>
    <div class="detail-grid">
      ${kv('Delivery Method', order.deliveryMethod)}
      ${kv('Delivery Charge', fmtCurrency(order.deliveryCharge))}
      ${kv('Expected Delivery', fmtDate(order.expectedDelivery))}
      ${kv('Current Location', order.currentLocation || '—')}
    </div>
    ${order.notes ? `<div class="form-section-title">Internal Notes</div><p style="font-size:13px;color:var(--text-dim);">${esc(order.notes)}</p>` : ''}
  `;
}

function kv(label, value){
  return `<div class="kv"><div class="kv-label">${label}</div><div class="kv-value">${esc(value || '—')}</div></div>`;
}

function renderTimelineTab(order){
  const timeline = [...(order.timeline||[])].sort((a,b) => new Date(a.date)-new Date(b.date));
  return `
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
  `;
}

function renderStatusTab(order){
  return `
    <div class="form-grid">
      <div class="field"><label>New Status</label>
        <select id="statusSelect">${ORDER_STATUSES.map(s => `<option ${order.currentStatus===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Current Location / Update</label>
        <input id="statusLocation" placeholder="e.g. Delhi NCR Hub" value="${esc(order.currentLocation)}">
      </div>
      <div class="field"><label>Expected Delivery</label>
        <input type="date" id="statusExpected" value="${order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().slice(0,10) : ''}">
      </div>
      <div class="field span-2"><label>Admin Note / Update Message</label>
        <textarea id="statusNote" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px 12px;" placeholder="e.g. Product testing completed successfully.">${esc(order.latestUpdate)}</textarea>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn btn-accent" onclick="submitStatusUpdate('${order.id}')">Update Status</button>
      <button class="btn btn-whatsapp" onclick="submitStatusUpdate('${order.id}', true)">${iconWhatsapp()} Update &amp; Send WhatsApp</button>
    </div>
  `;
}

function submitStatusUpdate(orderId, sendWhatsApp){
  const status = document.getElementById('statusSelect').value;
  const location = document.getElementById('statusLocation').value.trim();
  const expected = document.getElementById('statusExpected').value;
  const note = document.getElementById('statusNote').value.trim();

  const updated = addTimelineEvent(orderId, {
    status, location, note,
    expectedDelivery: expected ? new Date(expected).toISOString() : undefined
  });
  if(!updated){ toast('Could not update status — local storage may be full.', 'error'); return; }
  toast('Status updated.', 'success');
  DETAIL_TAB = 'timeline';
  document.getElementById('orderDetailRoot') && (document.getElementById('modalRoot').innerHTML = renderOrderDetailModal(updated));
  if(STATE.view === 'orders' || STATE.view === 'dashboard') renderView(STATE.view);

  if(sendWhatsApp) sendStatusUpdateWhatsApp(orderId);
}

function renderInvoiceTab(order){
  if(!order.invoice){
    return emptyState('No invoice uploaded', 'Edit the order to upload a bill or invoice.');
  }
  const isPdf = order.invoiceFileName && order.invoiceFileName.toLowerCase().endsWith('.pdf');
  return `
    <div class="file-preview" style="margin-bottom:14px;">
      <div class="file-preview-icon">${iconFile()}</div>
      <div class="file-preview-name">${esc(order.invoiceFileName)}</div>
      <button class="btn btn-sm" onclick="downloadInvoice('${order.id}')">Download / View</button>
    </div>
    ${!isPdf ? `<img src="${order.invoice}" style="max-width:100%;border-radius:10px;border:1px solid var(--border);">` : ''}
  `;
}
function downloadInvoice(orderId){
  const order = getOrderById(orderId);
  if(!order || !order.invoice) return;
  const a = document.createElement('a');
  a.href = order.invoice;
  a.download = order.invoiceFileName || 'invoice';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printOrder(orderId){
  const order = getOrderById(orderId);
  if(!order) return;
  const w = window.open('', '_blank');
  const timelineHtml = (order.timeline||[]).map(t => `<li><strong>${t.status}</strong> — ${fmtDateTime(t.date)}${t.location ? ' · '+esc(t.location) : ''}${t.note?'<br><em>'+esc(t.note)+'</em>':''}</li>`).join('');
  w.document.write(`
    <html><head><title>${order.trackingId} — Nexserve IT Solutions</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#111;} h1{font-size:20px;} table{width:100%;border-collapse:collapse;margin:14px 0;} td{padding:6px 0;border-bottom:1px solid #eee;} .label{color:#666;width:180px;} ul{padding-left:18px;}</style>
    </head><body>
    <h1>Nexserve IT Solutions — Order Summary</h1>
    <table>
      <tr><td class="label">Tracking ID</td><td>${order.trackingId}</td></tr>
      <tr><td class="label">Order ID</td><td>${order.orderId}</td></tr>
      <tr><td class="label">Customer</td><td>${esc(order.customerName)} · ${esc(order.mobile)}</td></tr>
      <tr><td class="label">Product</td><td>${esc(order.product)} ${order.model?('· '+esc(order.model)):''} × ${order.quantity}</td></tr>
      <tr><td class="label">Amount</td><td>${fmtCurrency(order.amount)}</td></tr>
      <tr><td class="label">Status</td><td>${order.currentStatus}</td></tr>
      <tr><td class="label">Expected Delivery</td><td>${fmtDate(order.expectedDelivery)}</td></tr>
    </table>
    <h3>Timeline</h3>
    <ul>${timelineHtml}</ul>
    </body></html>
  `);
  w.document.close();
  w.print();
}

/* ---------------------------------------------------------------------- */
/* WHATSAPP MESSAGE GENERATION                                              */
/* ---------------------------------------------------------------------- */
function sendTrackingLinkWhatsApp(orderId){
  const order = getOrderById(orderId);
  const settings = getSettings();
  const link = `${getTrackingBaseUrl()}?id=${encodeURIComponent(order.trackingId)}`;
  const msg =
`Hello ${order.customerName} 👋

Your order from ${settings.companyName} has been successfully received.

📦 Order ID: ${order.orderId}
🔎 Tracking ID: ${order.trackingId}
💻 Product: ${order.product}

You can track your order anytime using the link below:

${link}

📅 Expected Delivery: ${order.expectedDelivery ? fmtDate(order.expectedDelivery) : 'To be confirmed'}

Thank you for choosing ${settings.companyName}.

For support:
📞 ${settings.phone}
🌐 ${settings.website}`;
  window.open(buildWhatsAppUrl(order.whatsapp || order.mobile, msg), '_blank');
}

function sendStatusUpdateWhatsApp(orderId){
  const order = getOrderById(orderId);
  const settings = getSettings();
  const link = `${getTrackingBaseUrl()}?id=${encodeURIComponent(order.trackingId)}`;
  const msg =
`Hello ${order.customerName} 👋

Your ${settings.companyName} order update:

📦 Tracking ID: ${order.trackingId}

Current Status:
🚚 ${order.currentStatus}

📍 Current Location:
${order.currentLocation || 'Update in progress'}

📅 Expected Delivery:
${order.expectedDelivery ? fmtDate(order.expectedDelivery) : 'To be confirmed'}

Track your order:
${link}

Thank you,
${settings.companyName}
📞 ${settings.phone}`;
  window.open(buildWhatsAppUrl(order.whatsapp || order.mobile, msg), '_blank');
}

function copyTrackingLink(orderId){
  const order = getOrderById(orderId);
  const link = `${getTrackingBaseUrl()}?id=${encodeURIComponent(order.trackingId)}`;
  navigator.clipboard.writeText(link).then(
    () => toast('Tracking link copied to clipboard.', 'success'),
    () => toast('Could not copy link — please copy it manually: ' + link, 'error')
  );
}
