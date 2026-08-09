# Nexserve IT Solutions — Order & Delivery Tracking System

A complete, static, LocalStorage-powered order tracking dashboard for **Nexserve IT Solutions**. No backend, no database — runs entirely in the browser and deploys as a static site (GitHub Pages compatible).

---

## Files

```
index.html      Admin login + dashboard (SPA)
tracking.html   Public customer tracking page (no login)
style.css       Design system + all component styles
storage.js      Storage layer (LocalStorage) — the ONLY file that touches localStorage directly
app.js          Admin dashboard logic: auth, views, search/filter, reports, backup, settings
orders-ui.js    Order create/edit modal, order detail, status updates, WhatsApp messaging
tracking.js     Public tracking page logic
```

## 1. How to run locally

No build step is required.

- **Easiest:** double-click `index.html` to open it directly in your browser.
- **Recommended (avoids some browser file:// quirks):** serve the folder with any static server, e.g.:
  ```bash
  npx serve .
  # or
  python3 -m http.server 8000
  ```
  Then open `http://localhost:8000/index.html`.

## 2. Admin login details

- URL: `index.html`
- Username: `admin`
- Password: `Nexserve#8341`

⚠️ This is a **frontend-only** login. The credentials live in `app.js` and the session flag in browser storage — this is convenient for a small, single-admin static site, but it is **not real security** (anyone with access to the source or devtools can see the password). See "Security note" below.

## 3. How to create an order

1. Log in, then click **+ Create New Order** (Dashboard, Orders page, or Sidebar).
2. Fill in customer details, order/product details, and optionally upload a bill/invoice (PDF, JPG, JPEG, PNG).
3. A unique **Tracking ID** (e.g. `NXS-2026-0001`) and internal **Order ID** are generated automatically. Numbering restarts each year (`NXS-2027-0001`, ...).
4. Click **Create Order**. The order opens automatically so you can copy the tracking link or send it via WhatsApp.

## 4. How to update tracking / order status

1. Open any order (click a row, or the eye icon) → **Update Status** tab.
2. Choose the new status, current location/update text, expected delivery date, and an admin note.
3. Click **Update Status** to save, or **Update & Send WhatsApp** to save and immediately open a pre-filled WhatsApp message to the customer.
4. Every update is appended to the order's **Timeline** — previous history is never erased, even when you edit the order afterward.

## 5. How the customer tracks their order

- Customers open `tracking.html?id=NXS-2026-0001` — no login required.
- They can also land on `tracking.html` with no ID and type it into the search box.
- The page shows: current status, progress bar, current location, expected delivery, product summary, and the full timeline.
- It **never** shows: pricing, payment status/method, internal notes, invoices, or any admin-only data.

## 6. How WhatsApp sharing works

Two buttons generate a pre-filled WhatsApp message and open `wa.me` in a new tab:

- **Send Tracking Link** (on the order detail page) — sends the initial "order received" message with the tracking link.
- **Update & Send WhatsApp** (in the status-update tab) — sends the latest status, location, and expected delivery.

The customer's **WhatsApp number** field is used if filled in, otherwise their **mobile number** is used. Numbers are normalized to include the `91` country code when a 10-digit number is entered.

## 7. How to back up your data

Go to **Backup & Restore** in the sidebar:

- **Backup Now** — downloads `nexserve-orders-backup.json` containing all orders, settings, and ID counters.
- **Export CSV** — downloads `nexserve-orders.csv` for spreadsheets/reporting.

Do this regularly. LocalStorage lives only in one browser on one device — clearing browser data, using a different browser, or a different device will **not** show the same orders.

## 8. How to restore data

Still on **Backup & Restore**: choose your `nexserve-orders-backup.json` file and click **Restore Data**. This replaces all current orders with the contents of the backup file, so make sure it's the correct/latest file.

## 9. How to deploy to GitHub Pages

1. Create a new GitHub repository and push all six files to it (no build step needed).
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose the branch (e.g. `main`) and root folder, then save.
4. Your app will be live at:
   - Admin: `https://YOUR-USERNAME.github.io/YOUR-REPO/index.html`
   - Customer tracking: `https://YOUR-USERNAME.github.io/YOUR-REPO/tracking.html?id=NXS-2026-0001`
5. All paths in the project are relative, so it works from any subfolder/repo name without changes.

## 10. Important LocalStorage limitations

- **Per-browser, per-device only.** Orders created in Chrome on your laptop are invisible in Safari, on your phone, or to any other admin/computer.
- **Capacity is limited** (typically 5–10MB per site). Invoice files are stored as Base64, which is larger than the original file — many/large invoices can fill this up. You'll see a friendly error if a save fails because storage is full; export a backup and consider removing old invoices if this happens.
- **Clearing browser data deletes everything.** There is no server copy. Export backups regularly (see section 7).
- **Not multi-admin safe.** Two admins working in two different browsers will not see each other's changes.

## 11. How to migrate to Firebase/Supabase later

All data access in this project goes through a small set of functions in **`storage.js`**:

```js
saveOrder(order)
getOrders()
getOrderByTrackingId(trackingId)
getOrderById(id)
updateOrder(id, changes)
addTimelineEvent(id, event)
deleteOrder(id)
exportBackup() / importBackup(json)
getSettings() / saveSettings(settings)
```

Nothing else in `app.js`, `orders-ui.js`, or `tracking.js` talks to `localStorage` directly. To migrate:

1. Create a Firebase/Supabase project and replace the body of each function above with the equivalent SDK/API call (e.g. `getOrders()` → a Firestore query, `saveOrder()` → a Firestore `addDoc`/`setDoc`).
2. Keep the function names and return shapes the same, and the rest of the app keeps working unchanged.
3. Move the admin password check in `app.js` (`AUTH` object) to real server-side authentication (Firebase Auth, Supabase Auth, etc.) instead of a hardcoded value.
4. Move invoice file storage from Base64-in-LocalStorage to actual file storage (Firebase Storage / Supabase Storage), storing just the resulting URL in `invoice`.

---

## Security note (please read)

This is a static, frontend-only application built to run without a server, as requested. That means:

- The admin password is stored in client-side JavaScript and the "login" is just a local session flag — it keeps casual visitors out of the dashboard UI, but it is **not** a real access-control system.
- Order data sits in the browser's LocalStorage in plain form. Anyone with access to that browser/profile can view it via developer tools.
- For a real production deployment with genuine security and multi-device/multi-user support, migrate to a backend using the guide in section 11 above.

## Demo data

On first load, three demo orders (`NXS-YYYY-0001` to `0003`) are created automatically so you can explore the app immediately. They're labeled with a **Demo** badge and can be deleted individually from the Orders page like any other order.
