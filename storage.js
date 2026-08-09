/* ==========================================================================
   NEXSERVE — storage.js
   Storage abstraction layer.

   IMPORTANT: This project uses browser LocalStorage because it is a static,
   backend-free, GitHub-Pages-friendly demo/small-business tool. Frontend-only
   authentication and storage is NOT production-grade security — anyone with
   access to the browser/device can read or edit this data via devtools.

   For real multi-device, multi-user, securely-authenticated data, replace the
   functions in this file with calls to Firebase / Supabase / a real backend
   API. Every other file in the app talks to data ONLY through the functions
   below (saveOrder, getOrders, getOrderByTrackingId, updateOrder,
   deleteOrder, exportBackup, importBackup, getSettings, saveSettings) so a
   future migration only needs to change this one file.
   ========================================================================== */

const DB_KEYS = {
  ORDERS: 'nexserve_orders',
  SETTINGS: 'nexserve_settings',
  SESSION: 'nexserve_session',
  COUNTERS: 'nexserve_counters',
  LAST_BACKUP: 'nexserve_last_backup',
  INSTALLED: 'nexserve_installed_v1'
};

const DEFAULT_SETTINGS = {
  companyName: 'Nexserve IT Solutions',
  phone: '9462253470',
  email: 'contact@nexserveitsolutions.com',
  website: 'nexserveitsolutions.com',
  whatsapp: '919462253470',
  defaultDeliveryMsg: 'Thank you for choosing Nexserve IT Solutions. We will keep you updated at every step.',
  defaultExpectedText: 'Expected delivery will be shared once your order is confirmed.'
};

const ORDER_STATUSES = [
  'Order Received',
  'Order Confirmed',
  'Payment Confirmed',
  'Processing',
  'Product Testing',
  'Packing',
  'Ready for Dispatch',
  'Dispatched',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];

const STATUS_BADGE_CLASS = {
  'Order Received': 'badge-received',
  'Order Confirmed': 'badge-confirmed',
  'Payment Confirmed': 'badge-payment',
  'Processing': 'badge-processing',
  'Product Testing': 'badge-testing',
  'Packing': 'badge-packing',
  'Ready for Dispatch': 'badge-ready',
  'Dispatched': 'badge-dispatched',
  'In Transit': 'badge-transit',
  'Out for Delivery': 'badge-out',
  'Delivered': 'badge-delivered',
  'Cancelled': 'badge-cancelled'
};

/* ---------------------------------------------------------------------- */
/* Low-level safe JSON read/write                                          */
/* ---------------------------------------------------------------------- */
function _readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  }catch(e){
    console.error('Storage read error for', key, e);
    return fallback;
  }
}
function _writeJSON(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }catch(e){
    console.error('Storage write error for', key, e);
    return false; // likely QuotaExceededError — LocalStorage is full
  }
}

/* ---------------------------------------------------------------------- */
/* Settings                                                                 */
/* ---------------------------------------------------------------------- */
function getSettings(){
  return Object.assign({}, DEFAULT_SETTINGS, _readJSON(DB_KEYS.SETTINGS, {}));
}
function saveSettings(settings){
  return _writeJSON(DB_KEYS.SETTINGS, settings);
}

/* ---------------------------------------------------------------------- */
/* Tracking / Order ID generation — yearly numbering NXS-YYYY-####         */
/* ---------------------------------------------------------------------- */
function _getCounters(){
  return _readJSON(DB_KEYS.COUNTERS, {});
}
function _saveCounters(c){
  _writeJSON(DB_KEYS.COUNTERS, c);
}
function generateTrackingId(){
  const year = new Date().getFullYear();
  const counters = _getCounters();
  const next = (counters[year] || 0) + 1;
  counters[year] = next;
  _saveCounters(counters);
  return `NXS-${year}-${String(next).padStart(4, '0')}`;
}
function isTrackingIdTaken(trackingId, excludeId){
  return getOrders().some(o => o.trackingId === trackingId && o.id !== excludeId);
}

/* ---------------------------------------------------------------------- */
/* Orders CRUD — the storage-layer contract used by the rest of the app    */
/* ---------------------------------------------------------------------- */
function getOrders(){
  return _readJSON(DB_KEYS.ORDERS, []);
}

function getOrderById(id){
  return getOrders().find(o => o.id === id) || null;
}

function getOrderByTrackingId(trackingId){
  if(!trackingId) return null;
  const clean = trackingId.trim().toUpperCase();
  return getOrders().find(o => o.trackingId.toUpperCase() === clean) || null;
}

function saveOrder(order){
  const orders = getOrders();
  const now = new Date().toISOString();
  order.id = order.id || ('ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  order.createdAt = order.createdAt || now;
  order.updatedAt = now;
  if(!order.timeline || !order.timeline.length){
    order.timeline = [{
      status: order.currentStatus || 'Order Received',
      date: now,
      note: 'Order created in system.',
      location: order.currentLocation || ''
    }];
  }
  orders.unshift(order);
  const ok = _writeJSON(DB_KEYS.ORDERS, orders);
  return ok ? order : null;
}

function updateOrder(id, changes){
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if(idx === -1) return null;
  orders[idx] = Object.assign({}, orders[idx], changes, { updatedAt: new Date().toISOString() });
  const ok = _writeJSON(DB_KEYS.ORDERS, orders);
  return ok ? orders[idx] : null;
}

/* Appends a status update to an order's timeline WITHOUT erasing history */
function addTimelineEvent(id, event){
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if(idx === -1) return null;
  const order = orders[idx];
  order.timeline = order.timeline || [];
  order.timeline.push({
    status: event.status,
    date: event.date || new Date().toISOString(),
    note: event.note || '',
    location: event.location || order.currentLocation || ''
  });
  order.currentStatus = event.status;
  if(event.location) order.currentLocation = event.location;
  if(event.expectedDelivery) order.expectedDelivery = event.expectedDelivery;
  order.latestUpdate = event.note || order.latestUpdate;
  order.updatedAt = new Date().toISOString();
  orders[idx] = order;
  const ok = _writeJSON(DB_KEYS.ORDERS, orders);
  return ok ? order : null;
}

function deleteOrder(id){
  const orders = getOrders().filter(o => o.id !== id);
  return _writeJSON(DB_KEYS.ORDERS, orders);
}

/* ---------------------------------------------------------------------- */
/* Backup / Restore / CSV                                                  */
/* ---------------------------------------------------------------------- */
function exportBackup(){
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'nexserve-order-tracking',
    version: 1,
    orders: getOrders(),
    settings: getSettings(),
    counters: _getCounters()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexserve-orders-backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  localStorage.setItem(DB_KEYS.LAST_BACKUP, new Date().toISOString());
  return payload;
}

function getLastBackupDate(){
  return localStorage.getItem(DB_KEYS.LAST_BACKUP);
}

/* Returns {ok:boolean, message:string} */
function importBackup(jsonString){
  let data;
  try{
    data = JSON.parse(jsonString);
  }catch(e){
    return { ok:false, message:'This file is not valid JSON. Please select a Nexserve backup file.' };
  }
  if(!data || !Array.isArray(data.orders)){
    return { ok:false, message:'This JSON file does not match the Nexserve backup format.' };
  }
  _writeJSON(DB_KEYS.ORDERS, data.orders);
  if(data.settings) _writeJSON(DB_KEYS.SETTINGS, data.settings);
  if(data.counters) _writeJSON(DB_KEYS.COUNTERS, data.counters);
  return { ok:true, message: `Restored ${data.orders.length} orders successfully.` };
}

function exportCSV(){
  const orders = getOrders();
  const headers = ['Order ID','Tracking ID','Customer Name','Mobile','Product','Model','Quantity','Amount','Payment Status','Status','Order Date','Expected Delivery','City','State'];
  const rows = orders.map(o => [
    o.orderId, o.trackingId, o.customerName, o.mobile, o.product, o.model,
    o.quantity, o.amount, o.paymentStatus, o.currentStatus, o.orderDate, o.expectedDelivery, o.city, o.state
  ]);
  const csv = [headers, ...rows].map(r =>
    r.map(cell => {
      const v = (cell === undefined || cell === null) ? '' : String(cell);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
    }).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexserve-orders.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------- */
/* Demo data — seeded once on first install                                */
/* ---------------------------------------------------------------------- */
function seedDemoDataIfNeeded(){
  if(localStorage.getItem(DB_KEYS.INSTALLED)) return;
  localStorage.setItem(DB_KEYS.INSTALLED, '1');
  if(getOrders().length) return;

  const year = new Date().getFullYear();
  const mkDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  const demo = [
    {
      isDemo:true, orderId:'ORD-1001', trackingId:`NXS-${year}-0001`,
      customerName:'Rahul Sharma', mobile:'9876543210', whatsapp:'919876543210',
      email:'rahul.sharma@example.com', address:'12 MG Road', city:'Delhi', state:'Delhi', pincode:'110001',
      product:'Dell Laptop', model:'Inspiron 15', quantity:1, amount:52000,
      paymentStatus:'Paid', paymentMethod:'UPI', deliveryMethod:'Courier', deliveryCharge:0,
      orderDate: mkDate(9), expectedDelivery: mkDate(-1),
      currentStatus:'Delivered', currentLocation:'Delivered to customer',
      latestUpdate:'Package delivered and signed for.', notes:'Demo order — safe to delete.',
      invoice:null, invoiceFileName:null,
      timeline:[
        {status:'Order Received', date:mkDate(9), note:'Order placed by customer.', location:'Delhi NCR Hub'},
        {status:'Payment Confirmed', date:mkDate(8), note:'UPI payment confirmed.', location:'Delhi NCR Hub'},
        {status:'Processing', date:mkDate(7), note:'Preparing item for dispatch.', location:'Delhi NCR Hub'},
        {status:'Dispatched', date:mkDate(5), note:'Handed to delivery partner.', location:'Delhi NCR Hub'},
        {status:'Out for Delivery', date:mkDate(2), note:'Out with delivery agent.', location:'Local delivery center'},
        {status:'Delivered', date:mkDate(1), note:'Package delivered and signed for.', location:'Customer address'}
      ]
    },
    {
      isDemo:true, orderId:'ORD-1002', trackingId:`NXS-${year}-0002`,
      customerName:'Priya Verma', mobile:'9812345678', whatsapp:'919812345678',
      email:'priya.verma@example.com', address:'45 Park Street', city:'Jaipur', state:'Rajasthan', pincode:'302001',
      product:'HP Printer', model:'LaserJet M126nw', quantity:1, amount:14500,
      paymentStatus:'Paid', paymentMethod:'Card', deliveryMethod:'Courier', deliveryCharge:150,
      orderDate: mkDate(4), expectedDelivery: mkDate(-1),
      currentStatus:'Out for Delivery', currentLocation:'Jaipur Delivery Hub',
      latestUpdate:'Shipment is out with the delivery agent for today.', notes:'Demo order — safe to delete.',
      invoice:null, invoiceFileName:null,
      timeline:[
        {status:'Order Received', date:mkDate(4), note:'Order placed by customer.', location:'Jaipur Hub'},
        {status:'Payment Confirmed', date:mkDate(4), note:'Card payment confirmed.', location:'Jaipur Hub'},
        {status:'Packing', date:mkDate(3), note:'Item packed and quality-checked.', location:'Jaipur Hub'},
        {status:'Dispatched', date:mkDate(2), note:'Shipment dispatched.', location:'Jaipur Hub'},
        {status:'Out for Delivery', date:mkDate(0), note:'Shipment is out with the delivery agent for today.', location:'Jaipur Delivery Hub'}
      ]
    },
    {
      isDemo:true, orderId:'ORD-1003', trackingId:`NXS-${year}-0003`,
      customerName:'Amit Kumar', mobile:'9900112233', whatsapp:'919900112233',
      email:'amit.kumar@example.com', address:'8 Civil Lines', city:'Lucknow', state:'Uttar Pradesh', pincode:'226001',
      product:'CCTV Camera Set', model:'4-Channel HD Kit', quantity:2, amount:21000,
      paymentStatus:'Partial', paymentMethod:'Bank Transfer', deliveryMethod:'Self Pickup', deliveryCharge:0,
      orderDate: mkDate(1), expectedDelivery: mkDate(-3),
      currentStatus:'Processing', currentLocation:'Nexserve Service Center',
      latestUpdate:'Item is being configured and tested before dispatch.', notes:'Demo order — safe to delete.',
      invoice:null, invoiceFileName:null,
      timeline:[
        {status:'Order Received', date:mkDate(1), note:'Order placed by customer.', location:'Nexserve Service Center'},
        {status:'Order Confirmed', date:mkDate(1), note:'Order confirmed with customer.', location:'Nexserve Service Center'},
        {status:'Processing', date:mkDate(0), note:'Item is being configured and tested before dispatch.', location:'Nexserve Service Center'}
      ]
    }
  ];

  const orders = demo.map(o => ({ id:'ord_demo_' + o.orderId, createdAt:o.orderDate, updatedAt:o.orderDate, ...o }));
  _writeJSON(DB_KEYS.ORDERS, orders);
  _saveCounters({ [year]: 3 });
}

/* ---------------------------------------------------------------------- */
/* Shared formatting helpers                                               */
/* ---------------------------------------------------------------------- */
function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) +
    ' • ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtCurrency(n){
  if(n === undefined || n === null || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function badgeClassFor(status){
  return STATUS_BADGE_CLASS[status] || 'badge-received';
}
function paymentBadgeClass(status){
  if(status === 'Paid') return 'badge-paid';
  if(status === 'Partial') return 'badge-partial';
  return 'badge-unpaid';
}
function statusProgressPercent(status){
  const idx = ORDER_STATUSES.indexOf(status);
  if(status === 'Cancelled') return 100;
  const deliverableSteps = ORDER_STATUSES.filter(s => s !== 'Cancelled');
  const i = deliverableSteps.indexOf(status);
  if(i === -1) return 0;
  return Math.round(((i + 1) / deliverableSteps.length) * 100);
}

/* Build the WhatsApp share URL. Uses customer's WhatsApp/mobile if present. */
function buildWhatsAppUrl(phone, message){
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? '91' + digits : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function getTrackingBaseUrl(){
  // Works both locally and on GitHub Pages via relative-path resolution
  const path = window.location.pathname.replace(/index\.html$/, '');
  return window.location.origin + path + 'tracking.html';
}
