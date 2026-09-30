/* ═══════════════════════════════════════════════════════════════════════════
   ga-backup.js — «پشتیبان آکادمی» داخل پنل اعضا (فقط حساب اصلی/مدیر)

   چرا این صفحه اینجاست و آن کارِ پنل عملیات را تکرار نمی‌کند:
     * تنظیماتِ زمان‌بندی ابری (شامل ساعت مستقل پنل اعضا: `academySchedule`) و اجرای
       خودکار در `admin.puttclub.ir/` است — آن‌جا که نشست واقعی وجود دارد. این صفحه هیچ
       کلید ابری یا درخواست ناشناس نمی‌فرستد؛ اگر یک‌ روز آن‌جا باز نشد، داده اینجا نمی‌سوزد.
     * این‌جا نسخه‌ی **همین لحظه و همین مرورگر** گرفته می‌شود: همان کلیدهای `ga_*` که
       موتور ابری هم می‌خواند (از list خودِ cloud.js)، با کد اصلاح، و قابل بازگردانی.
     * پیش‌فرض‌ها تغییر رفتار نمی‌دهند: خروجی می‌گیرد، چیزی پاک نمی‌کند، و بازگردانی
       فقط با تأیید صریح و بعد از گرفتن نسخهٔ «قبل از بازگردانی» انجام می‌شود.

   بازگشت به حالت قبل: همین فایل را از index.html و build_standalone.py حذف کن.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const KIND = 'ga-academy-backup';
  const SLOTS_KEY = 'ga_backup_slots';
  const MAX_SLOTS = 2;
  const SLOT_BYTES = 1.2 * 1024 * 1024;         // localStorage quota ≈ 5MB; دو اسلات + سربار
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const num = n => (isFinite(n) ? Number(n) : 0).toLocaleString('fa-IR');
  const kb = bytes => num(Math.max(1, Math.round((bytes || 0) / 1024))) + ' کیلوبایت';
  const faStamp = d => {
    const p = n => String(n).padStart(2, '0'), t = p(d.getHours()) + ':' + p(d.getMinutes());
    try { if (window.Data && D.jalaliInfo) { const j = D.jalaliInfo(d); return j.yy + '/' + p(j.mm) + '/' + p(j.dd) + ' ' + t; } } catch (e) {}
    return d.toLocaleString('fa-IR');
  };
  const fileStamp = d => d.toISOString().slice(0,10).replace(/-/g,'') + '-' + String(d.getUTCHours()).padStart(2,'0') + String(d.getUTCMinutes()).padStart(2,'0');

  // هر کلیدی که اسمش بوی رمز می‌دهد، فقط با تیک صریح «همه‌چیز» بیرون می‌رود
  const SENSITIVE = /(cfg|conf|token|secret|key|passw|session|auth)/i;
  const KEYS_TO_KEEP_OUT = ['ga_cloud_cfg', 'ga_backup_slots'];   // never exported, never synced

  function store(){ try { return window.localStorage; } catch (e) { return null; } }

  /** the exact key set the cloud engine snapshots, with a safe fallback for a stand-alone file */
  function keys(){
    const L = store();
    if (!L) return [];
    if (window.GA_CLOUD && typeof GA_CLOUD.syncable === 'function') {
      // همان فهرستی که موتور ابری می‌خواند؛ اسلات‌های این صفحه هرگز داخل نسخه نمی‌روند
      try { return GA_CLOUD.syncable().filter(k => KEYS_TO_KEEP_OUT.indexOf(k) < 0); } catch (e) { /* fallback below */ }
    }
    const out = [];
    for (let i = 0; i < L.length; i++){ const k = L.key(i); if (k && k.indexOf('ga_') === 0 && k !== 'ga_') out.push(k); }   // everything ga_*, snapshot() decides what to leave out
    return out.sort();
  }

  function snapshot(includeSensitive){
    const L = store(); if (!L) return null;
    const all = keys(), keep = [], drop = [];
    all.forEach(k => {
      if (KEYS_TO_KEEP_OUT.indexOf(k) >= 0) { drop.push(k); return; }
      if (!includeSensitive && SENSITIVE.test(k)) { drop.push(k); return; }
      keep.push(k);
    });
    const data = {}; let bytes = 0;
    keep.forEach(k => { const v = L.getItem(k); if (v === null) return; data[k] = v; bytes += k.length + v.length; });
    return { kind: KIND, version: 1, at: new Date().toISOString(), atFa: faStamp(new Date()),
             keys: data, meta: { keyCount: Object.keys(data).length, bytes: bytes,
                                 excluded: drop, agent: navigator.userAgent.slice(0, 120) } };
  }

  async function hash(text){
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return { algo: 'sha256', hex: Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('') };
      } catch (e) { /* below */ }
    }
    let h1 = 0x811c9dc5, h2 = 0x01000193;                 // FNV-1a (دو دور) برای حالت بدون WebCrypto
    for (let i = 0; i < text.length; i++){ const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 + c + i, 0x811c9dc5) >>> 0; }
    return { algo: 'fnv1a', hex: h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0') };
  }
  async function withHash(snap){ const body = JSON.stringify(snap.keys); const h = await hash(body);
    snap.checksum = { algo: h.algo, sha256OfKeys: h.hex }; return snap; }

  function readSlots(){ try { return JSON.parse((store() || {}).getItem(SLOTS_KEY) || '[]'); } catch (e) { return []; } }
  function writeSlots(a){ const L = store(); if (!L) return false;
    try { L.setItem(SLOTS_KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }

  async function pushSlot(snap){
    const body = JSON.stringify(snap.keys), bytes = snap.meta.bytes;
    const entry = { at: snap.at, atFa: snap.atFa, reason: snap.reason || 'دستی', meta: snap.meta, checksum: snap.checksum };
    if (bytes <= SLOT_BYTES) entry.keys = snap.keys; else entry.keysOmitted = 'حجم ' + kb(bytes) + ' از سقف ' + kb(SLOT_BYTES) + ' بیشتر است — فایل را نگه دار';
    const list = [entry].concat(readSlots()).slice(0, MAX_SLOTS);
    return { stored: writeSlots(list), entry: entry, bytes: bytes };
  }

  function validate(obj){
    const errors = [];
    if (!obj || typeof obj !== 'object') return ['فایل خوانده نشد (JSON معتبر نیست).'];
    if (obj.kind !== KIND) errors.push('این فایل نسخهٔ پشتیبان آکادمی نیست (kind = ' + esc(obj.kind) + ').');
    if (obj.version !== 1) errors.push('نسخهٔ فایل (' + esc(obj.version) + ') برای این پنل ناشناخته است.');
    if (!obj.keys || typeof obj.keys !== 'object' || !Object.keys(obj.keys).length) errors.push('هیچ کلیدی در فایل نیست.');
    else Object.keys(obj.keys).forEach(k => { if (k.indexOf('ga_') !== 0) errors.push('کلید غیرمنتظره: ' + esc(k)); });
    return errors;
  }

  async function applySnapshot(obj, opts){
    const L = store(); if (!L) throw new Error('localStorage در این مرورگر در دسترس نیست.');
    const errors = validate(obj); if (errors.length) throw new Error(errors[0]);
    if (obj.checksum && obj.checksum.sha256OfKeys){
      const h = await hash(JSON.stringify(obj.keys));
      if (h.algo === obj.checksum.algo && h.hex !== obj.checksum.sha256OfKeys)
        throw new Error('کد اصلاح فایل نمی‌خورد — فایل نصفه‌نیمه یا دست‌خورده است. (' + h.hex.slice(0,12) + '…)');
    }
    const before = snapshot(true);
    if (before) await pushSlot(Object.assign(before, { reason: 'خودکار، پیش از بازگردانی' }));
    const incoming = Object.keys(obj.keys).filter(k => KEYS_TO_KEEP_OUT.indexOf(k) < 0);
    incoming.forEach(k => L.setItem(k, obj.keys[k]));
    let removed = 0;
    if (opts && opts.replace) keys().forEach(k => { if (incoming.indexOf(k) < 0) { L.removeItem(k); removed++; } });
    if (window.APP && APP.reloadData) { try { APP.reloadData(); } catch (e) {} }
    return { restored: incoming.length, removed: removed };
  }

  /* ── رندر صفحه ─────────────────────────────────────────────────────────────── */
  const card = (icon, title, tag, body) =>
    '<div class="glass gold-border" style="margin-bottom:18px"><div class="card-head"><span class="ic">' + icon +
    '</span><h3>' + title + '</h3>' + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>' + body + '</div>';
  const btn = (id, label, cls) => '<button class="btn ' + (cls || 'sm ghost') + '" id="' + id + '">' + label + '</button>';

  async function render(){
    const v = document.querySelector('#view'); if (!v) return;
    const allow = window.APP && APP.isMain && APP.isMain();
    if (!allow){
      v.innerHTML = card('🔒', 'دسترسی نیست', 'Admin only', '<p class="muted">این بخش فقط با حساب اصلی پنل باز می‌شود.</p>');
      return;
    }
    const L = store();
    const all = keys();
    let bytes = 0; all.forEach(k => { const s = L && L.getItem(k); if (s) bytes += k.length + s.length; });
    const slots = readSlots();
    let cloud = null; try { if (window.GA_CLOUD) cloud = GA_CLOUD.status(); } catch (e) {}
    const pending = cloud && typeof cloud.pending === 'number' ? cloud.pending : null;

    v.innerHTML =
      card('💾', 'پشتیبان آکادمی — همین مرورگر', 'محلی',
        '<p class="muted" style="margin:0 0 10px">نسخهٔ ابریِ آکادمی (ساختار و ساعت خودش: <code>backups/academy/&lt;تاریخ&gt;/</code>) در پنل عملیات تنظیم می‌شود؛ ' +
        'این‌جا نسخه‌ی فوریِ همین داده‌ها روی همین دستگاه گرفته و در صورت نیاز برگردانده می‌شود — بدون هیچ کلید یا اتصال تازه‌ای.</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:13px">' +
          '<span class="tag">' + num(all.length) + ' کلید</span>' +
          '<span class="tag">' + kb(bytes) + '</span>' +
          (pending !== null ? '<span class="tag">در صف همگام‌سازی: ' + num(pending) + '</span>' : '') +
          (slots.length ? '<span class="tag">' + slots.length + ' نسخهٔ آخر روی این دستگاه</span>' : '<span class="tag">هنوز نسخهٔ محلی نداریم</span>') +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
          btn('gab-export', '⬇️ گرفتن فایل نسخه') + btn('gab-slot', '📌 نگه‌داشتن روی این دستگاه') +
          '<label class="btn sm ghost" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="gab-all"> همه‌چیز (کلیدهای تنظیمی/حساس هم)</label>' +
        '</div>') +
      card('↩️', 'بازگردانی از فایل', 'با تأیید',
        '<input class="input" type="file" id="gab-file" accept=".json,application/json" style="max-width:420px">' +
        '<div id="gab-preview" class="muted" style="margin-top:8px">فایلی انتخاب نشده.</div>' +
        '<div id="gab-restore-actions" style="display:none;margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<label class="btn sm ghost" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="gab-replace"> کلیدهایی که در فایل نیستند پاک شوند</label>' +
          btn('gab-restore', '✅ بازگردانی', 'btn sm') +
        '</div>') +
      card('🗂', 'نسخه‌های آخر روی این دستگاه', MAX_SLOTS + ' اسلات',
        (slots.length
          ? slots.map((s, i) => '<div style="padding:7px 0;border-top:1px solid rgba(255,255,255,.07)">' +
              '<b>' + esc(s.atFa || s.at) + '</b> <span class="muted">' + esc(s.reason || 'دستی') + ' — ' +
              num(s.meta && s.meta.keyCount) + ' کلید، ' + kb(s.meta && s.meta.bytes) +
              (s.checksum ? '، ' + esc(s.checksum.algo) + ' ' + esc(String(s.checksum.sha256OfKeys).slice(0, 12)) : '') + '</span>' +
              (s.keysOmitted ? '<div class="muted" style="color:#ffcf6b">' + esc(s.keysOmitted) + '</div>'
                             : '<div style="margin-top:6px">' + btn('gab-use-' + i, 'بازگردانی این نسخه', 'btn sm') + '</div>') +
              '</div>').join('')
          : '<p class="muted">هیچ. دکمهٔ «نگه‌داشتن روی این دستگاه» دو نسخهٔ آخر را نگه می‌دارد (تا ' + kb(SLOT_BYTES) + ' هر کدام).</p>')) +
      card('ℹ️', 'زمان‌بندی ابری و ساعت مستقل اعضا', 'admin.puttclub.ir',
        '<p class="muted" style="margin:0 0 8px">اگر «پنل اعضا ساعت خودش را داشته باشد» در پنل عملیات روشن باشد، آکادمی جدا از سایت+فروشگاه و در ساعت خودش نسخه می‌گیرد؛ ' +
        'خاموش بودنش یعنی دقیقاً همان رفتار همیشگی (هر دو ساختار، یک اجرا). اجرای دستی فوری هم آن‌جا هست.</p>' +
        '<a class="btn sm ghost" href="https://admin.puttclub.ir/" target="_blank" rel="noopener noreferrer">باز کردن پنل عملیات ↗</a>');

    const inc = () => !!(v.querySelector('#gab-all') || {}).checked;
    let current = null;

    v.querySelector('#gab-export').addEventListener('click', async () => {
      const snap = await withHash(Object.assign(snapshot(inc()), { reason: 'دستی (فایل)' }));
      const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'academy-' + fileStamp(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      APP.toast('فایل نسخهٔ ' + kb(snap.meta.bytes) + ' گرفته شد ✓ (' + snap.checksum.algo + ' ' + snap.checksum.sha256OfKeys.slice(0, 12) + '…)', 'green');
    });

    v.querySelector('#gab-slot').addEventListener('click', async () => {
      const snap = await withHash(Object.assign(snapshot(inc()), { reason: 'دستی (اسلات دستگاه)' }));
      const r = await pushSlot(snap);
      APP.toast(r.stored ? 'روی همین دستگاه نگه داشته شد ✓ (' + snap.meta.keyCount + ' کلید)'
                         : 'جا در حافظهٔ مرورگر نبود — همان فایل را نگه دار', r.stored ? 'green' : 'orange');
      render();
    });

    v.querySelector('#gab-file').addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0];
      const box = v.querySelector('#gab-preview'), acts = v.querySelector('#gab-restore-actions');
      current = null; acts.style.display = 'none';
      if (!f) { box.textContent = 'فایلی انتخاب نشده.'; return; }
      try { current = JSON.parse(await f.text()); }
      catch (e) { box.innerHTML = '<span style="color:#ff8a8a">فایل JSON معتبر نیست.</span>'; return; }
      const errs = validate(current);
      const h = current && current.keys ? await hash(JSON.stringify(current.keys)) : null;
      const mismatch = current && current.checksum && h && current.checksum.algo === h.algo && current.checksum.sha256OfKeys !== h.hex;
      const before = keys().length, willTouch = current && current.keys ? Object.keys(current.keys).length : 0;
      box.innerHTML = (errs.length || mismatch)
        ? '<span style="color:#ff8a8a">' + esc(errs[0] || 'کد اصلاح با محتوای فایل نمی‌خورد — فایل ناقص یا دست‌خورده است.') + '</span>'
        : '✅ فایل معتبر است — <b>' + num(willTouch) + ' کلید</b>، ' + kb((current.meta || {}).bytes || 0) +
          '، تاریخ ' + esc(current.atFa || current.at || '?') + '، ' + esc(h ? h.algo : 'بدون کد اصلاح') +
          (current.meta && current.meta.excluded && current.meta.excluded.length ? ' — بدون ' + esc(current.meta.excluded.join('، ')) : '') +
          '<br><span class="muted">بازگردانی، ' + num(willTouch) + ' کلید فعلی را جایگزین می‌کند (الان ' + num(before) + ' کلید روی این دستگاه است). ' +
          'قبلش یک نسخهٔ خودکار از وضعیت فعلی نگه داشته می‌شود.</span>';
      if (!errs.length && !mismatch){ acts.style.display = 'flex'; }
    });

    v.querySelector('#gab-restore').addEventListener('click', async () => {
      if (!current) { APP.toast('اول فایل را انتخاب کن.', 'orange'); return; }
      const word = prompt('برای بازگردانی، کلمهٔ «بازگردانی» را تایپ کن:');
      if (!word || word.trim() !== 'بازگردانی') { APP.toast('بی‌خیال شد — چیزی تغییر نکرد.', 'orange'); return; }
      try {
        const r = await applySnapshot(current, { replace: !!(v.querySelector('#gab-replace') || {}).checked });
        APP.toast('بازگردانی شد ✓ ' + num(r.restored) + ' کلید' + (r.removed ? '، ' + num(r.removed) + ' کلید هم پاک شد' : ''), 'green');
        if (APP.go) APP.go('backup');
      } catch (e) { APP.toast('شدنی نشد: ' + e.message, 'red'); }
    });

    slots.forEach((s, i) => { const b = v.querySelector('#gab-use-' + i); if (!b || !s.keys) return;
      b.addEventListener('click', async () => {
        const word = prompt('برای بازگردانی نسخهٔ ' + (s.atFa || s.at) + ' کلمهٔ «بازگردانی» را تایپ کن:');
        if (!word || word.trim() !== 'بازگردانی') { APP.toast('بی‌خیال شد.', 'orange'); return; }
        try { const r = await applySnapshot({ kind: KIND, version: 1, keys: s.keys, checksum: s.checksum }, { replace: false });
              APP.toast('نسخهٔ دستگاه بازگردانده شد ✓ ' + num(r.restored) + ' کلید', 'green'); if (APP.go) APP.go('backup'); }
        catch (e) { APP.toast('شدنی نشد: ' + e.message, 'red'); }
      }); });
  }

  window.GA_BACKUP = { page: () => { render().catch(e => { if (window.APP) APP.toast('خطا: ' + e.message, 'red'); }); },
                       snapshot, applySnapshot, validate, keys, withHash, pushSlot, readSlots };
})();
