/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — فروشگاه آواتار (v8)
   • چیدمان سه‌ستونه: دسته‌بندی | ویترین | پیش‌نمایش زنده + سبد خرید
   • فیلتر برند/جنسیت/قیمت/تخفیف، ست کامل، علاقه‌مندی، نمای بزرگ آیتم
   • پنل مدیریت: محصول، دسته، برند، بستهٔ ویژه — همه قابل افزودن/ویرایش/حذف
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa  = n => (window.Data && Data.fa) ? Data.fa(n) : String(n);
  const $   = (s, r) => (r || document).querySelector(s);
  const $$  = (s, r) => Array.from((r || document).querySelectorAll(s));
  const toast = (m, c) => { if (window.APP && APP.toast) APP.toast(m, c); };
  const L = (id, fallback) => window.UI_LABELS ? UI_LABELS.t(id, fallback) : fallback;

  /* وضعیت ویترین (در حافظه) */
  const ST = { cat:'all', brand:'', gender:'', sort:'new', q:'', rot:0, slot:'' };

  /* دسته‌های ویترین (ترکیبی از اسلات‌های واقعی + دسته‌های هوشمند) */
  const VIEW_CATS = [
    { id:'all',   ic:'▦', k:'shop.cat.all', n:'همه آیتم‌ها' },
    { id:'men',   ic:'👔', k:'shop.cat.men', n:'لباس مردانه' },
    { id:'women', ic:'👗', k:'shop.cat.women', n:'لباس زنانه' },
    { id:'hat',   ic:'🧢', k:'shop.cat.hat', n:'کلاه و ویزور' },
    { id:'glove', ic:'🧤', k:'shop.cat.glove', n:'دستکش' },
    { id:'shoes', ic:'👟', k:'shop.cat.shoes', n:'کفش' },
    { id:'bag',   ic:'🎒', k:'shop.cat.bag', n:'کیف گلف' },
    { id:'club',  ic:'🏌️', k:'shop.cat.club', n:'چوب گلف' },
    { id:'ball',  ic:'⛳', k:'shop.cat.ball', n:'توپ و تجهیزات' },
    { id:'glass', ic:'🕶️', k:'shop.cat.glass', n:'عینک' },
    { id:'watch', ic:'⌚', k:'shop.cat.watch', n:'ساعت و اکسسوری' },
    { id:'look',  ic:'💇', k:'shop.cat.look', n:'چهره و مو' },
    { id:'bundle',ic:'🎁', k:'shop.cat.bundle', n:'بسته‌های ویژه' },
    { id:'new',   ic:'✨', k:'shop.cat.new', n:'آیتم‌های جدید' },
    { id:'sale',  ic:'🏷️', k:'shop.cat.sale', n:'تخفیف‌دار' },
    { id:'fav',   ic:'❤️', k:'shop.cat.fav', n:'علاقه‌مندی‌ها' },
  ];
  /* اسلات‌های قابل پوشیدن در نوار کناری پیش‌نمایش */
  const SLOTS = [
    ['hat','🧢','کلاه','shop.slot.hat'], ['shirt','👕','بالاتنه','shop.slot.shirt'], ['pants','👖','پایین‌تنه','shop.slot.pants'], ['shoes','👟','کفش','shop.slot.shoes'],
    ['glove','🧤','دستکش','shop.slot.glove'], ['glass','🕶️','عینک','shop.slot.glass'], ['bag','🎒','کیف','shop.slot.bag'], ['club','🏌️','چوب','shop.slot.club'],
    ['watch','⌚','ساعت','shop.slot.watch'], ['ball','⛳','توپ','shop.slot.ball'],
  ];

  function viewCats(){
    const hidden = (AV.catsAll() || []).filter(c => c.off).map(c => c.id);
    const custom = (AV.catsAll() || []).filter(c => !c.base && !c.off)
      .map(c => ({ id:c.id, ic:c.icon || '🏷️', n:c.label || c.id }));
    const base = VIEW_CATS.filter(c => !hidden.includes(c.id)).map(c => Object.assign({}, c, { n:L(c.k, c.n) }));
    return base.concat(custom);
  }

  /* فیلتر آیتم‌ها بر اساس وضعیت */
  function itemsFor(user, av){
    let list = AV.shop().filter(i => ['hair','eyes','skin'].indexOf(i.cat) === -1 || ST.cat === 'look');
    const favs = AV.favs(user);
    if (ST.slot) list = list.filter(i => i.cat === ST.slot);
    else switch (ST.cat){
      case 'all':   list = list.filter(i => ['hair','eyes','skin'].indexOf(i.cat) === -1); break;
      case 'men':   list = list.filter(i => ['shirt','pants'].includes(i.cat) && i.g !== 'f'); break;
      case 'women': list = list.filter(i => ['shirt','pants'].includes(i.cat) && (i.g === 'f' || i.g === 'a')); break;
      case 'look':  list = list.filter(i => ['hair','eyes','skin'].includes(i.cat)); break;
      case 'new':   list = list.filter(i => AV.itemMeta(i).isNew); break;
      case 'sale':  list = list.filter(i => AV.itemMeta(i).disc > 0); break;
      case 'fav':   list = list.filter(i => favs.includes(i.id)); break;
      case 'bundle': list = []; break;
      default:      list = list.filter(i => i.cat === ST.cat);
    }
    if (ST.brand)  list = list.filter(i => i.b === ST.brand);
    if (ST.gender) list = list.filter(i => i.g === 'a' || i.g === ST.gender);
    if (ST.q){
      const q = ST.q.trim();
      const br = AV.brands();
      list = list.filter(i => (i.n || '').includes(q) || ((br[i.b] || {}).name || '').toLowerCase().includes(q.toLowerCase()));
    }
    const meta = i => AV.itemMeta(i);
    if (ST.sort === 'new')      list = list.slice().sort((a,b) => (meta(b).isNew?1:0) - (meta(a).isNew?1:0) || (+b.price||0) - (+a.price||0));
    else if (ST.sort === 'pop') list = list.slice().sort((a,b) => meta(b).rate - meta(a).rate);
    else if (ST.sort === 'sold')list = list.slice().sort((a,b) => meta(b).sold - meta(a).sold);
    else if (ST.sort === 'sale')list = list.slice().sort((a,b) => (meta(b).disc?1:0) - (meta(a).disc?1:0));
    else if (ST.sort === 'lo')  list = list.slice().sort((a,b) => (+a.price||0) - (+b.price||0));
    else if (ST.sort === 'hi')  list = list.slice().sort((a,b) => (+b.price||0) - (+a.price||0));
    return list;
  }

  function stars(r){
    const full = Math.floor(r), half = r - full >= .5;
    let h = '';
    for (let i=0;i<5;i++) h += `<span class="s ${i < full ? 'on' : (i === full && half ? 'half' : '')}">★</span>`;
    return `<span class="as-rate">${h}<b>${fa(r.toFixed(1))}</b></span>`;
  }
  function brandChip(b){
    const br = AV.brands()[b] || { name:b, c:'#8A93A6' };
    return `<span class="as-brand" style="color:${br.c};border-color:${br.c}55;background:${br.c}18">${esc(br.name)}</span>`;
  }
  function priceHTML(it){
    const m = AV.itemMeta(it);
    const p = +it.price || 0;
    if (p === 0) return `<span class="as-price free">رایگان</span>`;
    return `<span class="as-price">🪙 ${fa(p)}</span>` +
      (m.disc ? `<span class="as-old">${fa(m.disc)}</span>` : '') +
      (m.toman ? `<span class="as-toman">${fa(Math.round(m.toman).toLocaleString('en-US'))} تومان</span>` : '');
  }

  /* ═══════════ ویترین اصلی ═══════════ */
  function renderShop(root, user, opt){
    opt = opt || {};
    const av = AV.avatarOf(user, opt.gender);
    const coin = AV.coinOf(user);
    const owned = new Set(av.owned);
    const cart = AV.cart(user);
    const favs = AV.favs(user);
    const list = itemsFor(user, av);
    const bundles = AV.bundles();
    const brandList = Object.entries(AV.brands()).filter(([id]) => AV.shop().some(i => i.b === id));

    root.innerHTML = `
    <div class="ashop">
      <!-- ستون دسته‌بندی -->
      <aside class="as-side">
        <div class="as-side-hd">
          <div><h4>${esc(L('shop.title','فروشگاه آواتار'))}</h4><small>استایل منحصر به خود را بسازید</small></div><span class="ic">🛍️</span>
        </div>
        <div class="as-cats">
          ${viewCats().map(c => `<div class="as-cat ${(!ST.slot && ST.cat === c.id) ? 'on' : ''}" data-scat="${c.id}"><span class="i">${c.ic}</span><span>${esc(c.n)}</span></div>`).join('')}
        </div>
        <button class="as-newav" id="as-newav">👤＋ ساخت اوتار جدید</button>
      </aside>

      <!-- ویترین -->
      <main class="as-main">
        <div class="as-hero" style="background-image:url(assets/shop_hero.webp)">
          <div class="as-hero-txt">
            <h2>اوتار اختصاصی شما</h2>
            <p>استایل خود را انتخاب کنید و در مسابقات بدرخشید</p>
            <button class="as-cta" id="as-tomy">👤 مشاهده اوتار من</button>
          </div>
        </div>

        <div class="as-filters">
          <button class="as-f ${ST.sort==='new'?'on':''}" data-sort="new">${esc(L('shop.sort.new','جدیدترین‌ها'))}</button>
          <button class="as-f ${ST.sort==='pop'?'on':''}" data-sort="pop">${esc(L('shop.sort.pop','محبوب‌ترین'))}</button>
          <button class="as-f ${ST.sort==='sale'?'on':''}" data-sort="sale">${esc(L('shop.sort.sale','تخفیف‌دار'))}</button>
          <button class="as-f ${ST.sort==='sold'?'on':''}" data-sort="sold">${esc(L('shop.sort.sold','پرفروش‌ترین'))}</button>
          <button class="as-f ${ST.sort==='lo'?'on':''}" data-sort="lo">${esc(L('shop.sort.low','ارزان‌ترین'))}</button>
          <button class="as-f ${ST.sort==='hi'?'on':''}" data-sort="hi">${esc(L('shop.sort.high','گران‌ترین'))}</button>
          <select class="as-sel" id="as-brand">
            <option value="">همه برندها</option>
            ${brandList.map(([id, b]) => `<option value="${id}" ${ST.brand===id?'selected':''}>${esc(b.name)}</option>`).join('')}
          </select>
          <select class="as-sel" id="as-gender">
            <option value="" ${ST.gender===''?'selected':''}>مردانه و زنانه</option>
            <option value="m" ${ST.gender==='m'?'selected':''}>مردانه</option>
            <option value="f" ${ST.gender==='f'?'selected':''}>زنانه</option>
          </select>
          <input class="as-search" id="as-q" placeholder="🔎 جستجوی آیتم یا برند" value="${esc(ST.q)}">
        </div>

        <div class="as-brands">
          <span class="as-bl ${ST.brand===''?'on':''}" data-brand="">همه</span>
          ${brandList.map(([id, b]) => `<span class="as-bl ${ST.brand===id?'on':''}" data-brand="${id}" style="--bc:${b.c}">${esc(b.name)}</span>`).join('')}
        </div>

        ${ST.cat === 'bundle' ? bundlesHTML(bundles, owned) : `
        <div class="as-grid">
          ${list.map(it => cardHTML(it, owned, av, favs, cart, coin)).join('') ||
            `<div class="as-empty">آیتمی با این فیلتر پیدا نشد — فیلترها را تغییر دهید.</div>`}
        </div>
        ${bundles.length ? `<div class="as-outfit-wrap">${bundlesHTML(bundles, owned)}</div>` : ''}`}

        <div class="as-feats">
          <div class="as-feat"><span>🏆</span><div><b>نمایش در مسابقات</b><small>در همهٔ مسابقات بدرخشید</small></div></div>
          <div class="as-feat"><span>✨</span><div><b>افزایش امتیاز</b><small>استایل بهتر، امتیاز بیشتر</small></div></div>
          <div class="as-feat"><span>🎨</span><div><b>استایل منحصر به فرد</b><small>اوتار خود را خاص کنید</small></div></div>
          <div class="as-feat"><span>✅</span><div><b>کیفیت بالا</b><small>بهترین برندهای گلف دنیا</small></div></div>
        </div>
      </main>

      <!-- پیش‌نمایش زنده + سبد -->
      <aside class="as-prev">
        <div class="as-prev-hd"><h4>${esc(L('shop.preview','پیش‌نمایش آواتار'))}</h4><span class="as-coin">🪙 ${fa(coin.total)}</span></div>
        <div class="as-stage">
          <div class="as-slots">
            ${SLOTS.map(([id, ic, t, k]) => `<button class="as-slot ${ST.slot===id?'on':''}" data-slot="${id}" title="${esc(L(k,t))}">${ic}</button>`).join('')}
          </div>
          <div class="as-podium">
            <div class="as-av" id="as-av" style="transform:rotateY(${ST.rot}deg)">${AV.renderAvatarSVG(av.sel, { gender: av.gender, w: 168, h: 302 })}</div>
            <div class="as-disc"></div>
          </div>
          <div class="as-rotate">
            <button class="as-rb" data-rot="-30">⟲</button>
            <button class="as-rb" id="as-spin">چرخش ۳۶۰°</button>
            <button class="as-rb" data-rot="30">⟳</button>
          </div>
          <div class="as-gender">
            <button class="as-gb ${av.gender==='m'?'on':''}" data-agender="m">🙍‍♂️ آقا</button>
            <button class="as-gb ${av.gender==='f'?'on':''}" data-agender="f">🙍‍♀️ خانم</button>
          </div>
        </div>
        <div class="as-cart">
          <div class="as-cart-hd"><h4>${esc(L('shop.cart','سبد خرید'))}</h4><span class="as-badge">${fa(cart.length)}</span></div>
          <div class="as-cart-list">
            ${cart.length ? cart.map(id => {
              const it = AV.shopItem(id); if (!it) return '';
              return `<div class="as-ci">
                <span class="th">${AV.itemPreviewSVG(it, 40)}</span>
                <span class="nm">${esc(it.n)}<b>🪙 ${fa(+it.price||0)}</b></span>
                <button class="rm" data-cdel="${it.id}">✕</button>
              </div>`;
            }).join('') : `<div class="as-cart-empty">سبد خرید شما خالی است — از ویترین آیتم اضافه کنید.</div>`}
          </div>
          <div class="as-cart-total"><span>مجموع</span><b>🪙 ${fa(AV.cartTotal(user))}</b></div>
          <button class="as-checkout" id="as-checkout" ${cart.length ? '' : 'disabled'}>تکمیل خرید</button>
        </div>
      </aside>
    </div>
    <div id="as-modal"></div>`;

    wire(root, user, opt);
  }

  function cardHTML(it, owned, av, favs, cart, coin){
    const m = AV.itemMeta(it);
    const isOwned = owned.has(it.id);
    const isSel = av.sel[it.cat] === it.id;
    const inCart = cart.includes(it.id);
    const canBuy = coin.total >= (+it.price || 0);
    const isFav = favs.includes(it.id);
    return `<div class="as-card ${isSel ? 'sel' : ''}" data-card="${it.id}">
      <div class="as-tags">
        ${m.isNew ? '<span class="t new">جدید</span>' : ''}
        ${m.disc ? '<span class="t sale">تخفیف</span>' : ''}
        ${m.stock < 8 ? `<span class="t low">${fa(m.stock)} عدد</span>` : ''}
      </div>
      <button class="as-fav ${isFav ? 'on' : ''}" data-fav="${it.id}" title="علاقه‌مندی">${isFav ? '❤️' : '🤍'}</button>
      <div class="as-thumb" data-view="${it.id}">
        ${it.img ? `<img src="${esc(it.img)}" alt="${esc(it.n)}">` : AV.itemPreviewSVG(it, 96)}
        <span class="as-zoom">🔍 نمای بزرگ</span>
      </div>
      ${brandChip(it.b)}
      <div class="as-nm">${esc(it.n)}</div>
      ${stars(m.rate)}
      <div class="as-pr">${priceHTML(it)}</div>
      <div class="as-actions">
        ${isSel ? `<span class="as-worn">پوشیده ✓</span>`
          : isOwned ? `<button class="as-buy own" data-sel="${it.id}">پوشیدن</button>`
          : `<button class="as-buy ${canBuy ? '' : 'no'}" data-buy="${it.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'خرید' : 'سکه کم است'}</button>`}
        ${isOwned ? '' : `<button class="as-cartbtn ${inCart ? 'on' : ''}" data-cart="${it.id}" title="افزودن به سبد">🛒</button>`}
      </div>
    </div>`;
  }

  function bundlesHTML(bundles, owned){
    if (!bundles.length) return `<div class="as-empty">هنوز بستهٔ ویژه‌ای تعریف نشده است — مدیر می‌تواند از «پلن مدیریت ← فروشگاه اوتار ← بسته‌های ویژه» اضافه کند.</div>`;
    return `<div class="as-outfit">
      <div class="as-outfit-hd"><h3>🎁 خرید استایل کامل (Complete Outfit)</h3><span>ست‌های آماده با قیمت ویژه</span></div>
      <div class="as-bundles">
        ${bundles.map(b => {
          const items = (b.ids || []).map(id => AV.shopItem(id)).filter(Boolean);
          const sum = items.reduce((s, i) => s + (+i.price || 0), 0);
          const price = +b.price || sum;
          const have = items.every(i => owned.has(i.id));
          return `<div class="as-bundle">
            <div class="as-bnd-items">${items.map(i => `<span>${AV.itemPreviewSVG(i, 52)}</span>`).join('')}</div>
            <div class="as-bnd-nm">${esc(b.n)}</div>
            <div class="as-bnd-list">${items.map(i => esc(i.n)).join(' • ')}</div>
            <div class="as-bnd-pr">🪙 ${fa(price)} ${price < sum ? `<span class="as-old">${fa(sum)}</span>` : ''}</div>
            ${have ? `<span class="as-worn">این ست را دارید ✓</span>` : `<button class="as-buy" data-bundle="${b.id}">خرید استایل کامل</button>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* ═══════════ رویدادها ═══════════ */
  function wire(root, user, opt){
    const again = () => renderShop(root, user, opt);
    const refresh = () => { if (opt.onChange) opt.onChange(); else again(); };

    $$('[data-scat]', root).forEach(el => el.addEventListener('click', () => { ST.cat = el.dataset.scat; ST.slot = ''; again(); }));
    $$('[data-slot]', root).forEach(el => el.addEventListener('click', () => {
      ST.slot = (ST.slot === el.dataset.slot) ? '' : el.dataset.slot;
      if (ST.slot) ST.cat = '';
      else ST.cat = 'all';
      again();
    }));
    $$('[data-sort]', root).forEach(el => el.addEventListener('click', () => { ST.sort = el.dataset.sort; again(); }));
    $$('[data-brand]', root).forEach(el => el.addEventListener('click', () => { ST.brand = el.dataset.brand; again(); }));
    const bs = $('#as-brand', root); if (bs) bs.addEventListener('change', () => { ST.brand = bs.value; again(); });
    const gs = $('#as-gender', root); if (gs) gs.addEventListener('change', () => { ST.gender = gs.value; again(); });
    const q = $('#as-q', root);
    if (q) q.addEventListener('keyup', e => { if (e.key === 'Enter'){ ST.q = q.value; again(); } });

    $$('[data-buy]', root).forEach(b => b.addEventListener('click', () => {
      const r = AV.buyItem(user, b.dataset.buy);
      toast(r.msg, r.ok ? 'green' : 'red');
      refresh();
    }));
    $$('[data-sel]', root).forEach(b => b.addEventListener('click', () => { AV.selectItem(user, b.dataset.sel); refresh(); }));
    $$('[data-cart]', root).forEach(b => b.addEventListener('click', () => {
      const r = AV.cartAdd(user, b.dataset.cart);
      toast(r.msg, r.ok ? 'green' : 'gold');
      again();
    }));
    $$('[data-cdel]', root).forEach(b => b.addEventListener('click', () => { AV.cartRemove(user, b.dataset.cdel); again(); }));
    $$('[data-fav]', root).forEach(b => b.addEventListener('click', () => {
      const on = AV.toggleFav(user, b.dataset.fav);
      toast(on ? 'به علاقه‌مندی‌ها اضافه شد ❤️' : 'از علاقه‌مندی‌ها حذف شد', 'gold');
      again();
    }));
    $$('[data-bundle]', root).forEach(b => b.addEventListener('click', () => {
      const r = AV.buyBundle(user, b.dataset.bundle);
      toast(r.msg, r.ok ? 'green' : 'red');
      refresh();
    }));
    const co = $('#as-checkout', root);
    if (co) co.addEventListener('click', () => {
      const r = AV.checkout(user);
      toast(r.msg, r.ok ? 'green' : 'red');
      refresh();
    });
    $$('[data-view]', root).forEach(el => el.addEventListener('click', () => itemModal(el.dataset.view, user, refresh)));
    $$('[data-agender]', root).forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.agender;
      const rec = AV.avatarOf(user);
      const sel = Object.assign({}, rec.sel);
      ['hair','hat','shirt','pants'].forEach(cat => {
        const it = AV.shopItem(sel[cat]);
        if (it && it.g !== 'a' && it.g !== g) sel[cat] = AV.DEFAULT_SEL(g)[cat];
      });
      AV.setAvatar(user, { gender: g, sel });
      refresh();
    }));
    /* چرخش آواتار */
    const avEl = $('#as-av', root);
    $$('[data-rot]', root).forEach(b => b.addEventListener('click', () => {
      ST.rot += +b.dataset.rot;
      if (avEl) avEl.style.transform = 'rotateY(' + ST.rot + 'deg)';
    }));
    const spin = $('#as-spin', root);
    if (spin && avEl) spin.addEventListener('click', () => {
      avEl.classList.remove('spin'); void avEl.offsetWidth; avEl.classList.add('spin');
    });
    if (avEl){
      let down = false, x0 = 0, r0 = 0;
      const start = e => { down = true; x0 = (e.touches ? e.touches[0].clientX : e.clientX); r0 = ST.rot; };
      const move = e => {
        if (!down) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        ST.rot = r0 + (x - x0) * .6;
        avEl.style.transform = 'rotateY(' + ST.rot + 'deg)';
      };
      const end = () => { down = false; };
      avEl.addEventListener('mousedown', start); avEl.addEventListener('touchstart', start, { passive:true });
      window.addEventListener('mousemove', move); avEl.addEventListener('touchmove', move, { passive:true });
      window.addEventListener('mouseup', end); avEl.addEventListener('touchend', end);
    }
    const nav = $('#as-newav', root);
    if (nav) nav.addEventListener('click', () => {
      const rec = AV.avatarOf(user);
      AV.setAvatar(user, { sel: AV.DEFAULT_SEL(rec.gender) });
      toast('اوتار جدید ساخته شد — خریدهای شما محفوظ است (از کمد دوباره بپوشید)', 'green');
      refresh();
    });
    const tomy = $('#as-tomy', root);
    if (tomy) tomy.addEventListener('click', () => {
      const st = root.querySelector('.as-prev');
      if (st) st.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  }

  /* نمای بزرگ آیتم */
  function itemModal(id, user, refresh){
    const it = AV.shopItem(id); if (!it) return;
    const m = AV.itemMeta(it);
    const av = AV.avatarOf(user);
    const owned = av.owned.includes(id);
    const br = AV.brands()[it.b] || { name: it.b, c:'#8A93A6', tier:'—' };
    let host = document.getElementById('as-modal');
    if (!host){ host = document.createElement('div'); host.id = 'as-modal'; document.body.appendChild(host); }
    host.innerHTML = `<div class="as-mask">
      <div class="as-dlg">
        <button class="as-x" id="as-x">✕</button>
        <div class="as-dlg-in">
          <div class="as-dlg-img">${it.img ? `<img src="${esc(it.img)}" alt="">` : AV.itemPreviewSVG(it, 210)}</div>
          <div class="as-dlg-info">
            ${brandChip(it.b)}
            <h3>${esc(it.n)}</h3>
            ${stars(m.rate)}
            <div class="as-dlg-pr">${priceHTML(it)}</div>
            <ul class="as-dlg-ul">
              <li>ردهٔ برند: <b>${esc(br.tier || '—')}</b></li>
              <li>دسته: <b>${esc((AV.CATS.find(c => c[0] === it.cat) || ['','—'])[1])}</b></li>
              <li>مناسب: <b>${it.g === 'f' ? 'خانم' : it.g === 'm' ? 'آقا' : 'خانم و آقا'}</b></li>
              <li>موجودی: <b>${fa(m.stock)} عدد</b> • فروش: <b>${fa(m.sold)}</b></li>
            </ul>
            <div class="as-dlg-btns">
              ${owned ? `<button class="as-buy own" id="as-dsel">پوشیدن روی اوتار</button>`
                      : `<button class="as-buy" id="as-dbuy">خرید — 🪙 ${fa(+it.price||0)}</button>
                         <button class="as-cartbtn" id="as-dcart">🛒 افزودن به سبد</button>`}
            </div>
          </div>
        </div>
      </div></div>`;
    const close = () => { host.innerHTML = ''; };
    $('#as-x', host).addEventListener('click', close);
    host.querySelector('.as-mask').addEventListener('click', e => { if (e.target.classList.contains('as-mask')) close(); });
    const b1 = $('#as-dbuy', host), b2 = $('#as-dcart', host), b3 = $('#as-dsel', host);
    if (b1) b1.addEventListener('click', () => { const r = AV.buyItem(user, id); toast(r.msg, r.ok ? 'green' : 'red'); close(); refresh(); });
    if (b2) b2.addEventListener('click', () => { const r = AV.cartAdd(user, id); toast(r.msg, r.ok ? 'green' : 'gold'); close(); refresh(); });
    if (b3) b3.addEventListener('click', () => { AV.selectItem(user, id); close(); refresh(); });
  }


  /* ═══════════════════════════════════════════════════════════════
     پنل مدیریت فروشگاه آواتار — محصول / دسته / برند / بستهٔ ویژه
     ═══════════════════════════════════════════════════════════════ */
  let ATAB = 'items', AFILT = '';
  function renderAdmin(root){
    const tabs = [
      ['items','🛍️ ' + L('shop.products','محصولات')], ['cats','🗂️ ' + L('shop.categories','دسته‌بندی‌ها')],
      ['brands','🏷️ ' + L('shop.brands','برندها')], ['bundles','🎁 ' + L('shop.bundles','بسته‌های ویژه')]
    ];
    root.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:14px">
      <div class="card-head"><span class="ic">🛍️</span><h3>${esc(L('shop.title','فروشگاه آواتار'))} — مدیریت کامل</h3>
        <span class="tag">${fa(AV.shopAll().length)} محصول</span></div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        همه‌چیز بدون برنامه‌نویسی: افزودن/ویرایش/حذف محصول، دسته، برند و بستهٔ ویژه؛ قیمت سکه‌ای و تومانی،
        قیمت قبل از تخفیف، موجودی، جنسیت، رنگ‌ها، محل نصب روی اوتار، آپلود تصویر و فعال/غیرفعال کردن.
      </div>
      <div class="asa-tabs" style="margin-top:12px">
        ${tabs.map(([id, n]) => `<div class="asa-tab ${ATAB===id?'on':''}" data-atab="${id}">${esc(n)}</div>`).join('')}
      </div>
    </div>
    <div id="asa-body"></div>`;
    $$('[data-atab]', root).forEach(t => t.addEventListener('click', () => { ATAB = t.dataset.atab; renderAdmin(root); }));
    const body = $('#asa-body', root);
    if (ATAB === 'items') adminItems(body, root);
    else if (ATAB === 'cats') adminCats(body, root);
    else if (ATAB === 'brands') adminBrands(body, root);
    else adminBundles(body, root);
  }

  const SLOT_OPTS = () => AV.CATS.map(([id, n]) => [id, n]);

  function adminItems(body, root){
    const all = AV.shopAll();
    const brands = AV.brands();
    const list = AFILT ? all.filter(i => i.cat === AFILT) : all;
    body.innerHTML = `
    <div class="glass" style="margin-bottom:14px">
      <div class="card-head"><span class="ic">➕</span><h3>افزودن محصول جدید</h3><span class="tag">بدون کدنویسی</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>نام محصول</label><input class="input" id="np-n" style="width:100%" placeholder="مثلاً: پولوشرت نایک سبز"></div>
        <div><label>دسته / محل نصب روی اوتار</label>
          <select class="sel" id="np-cat" style="width:100%">${SLOT_OPTS().map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></div>
        <div><label>برند</label>
          <select class="sel" id="np-b" style="width:100%">${Object.entries(brands).map(([id, b]) => `<option value="${id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div><label>قیمت (سکه)</label><input class="input" type="number" id="np-p" value="30" style="width:100%;direction:ltr"></div>
        <div><label>قیمت قبل از تخفیف (اختیاری)</label><input class="input" type="number" id="np-disc" placeholder="0" style="width:100%;direction:ltr"></div>
        <div><label>قیمت تومانی (اختیاری)</label><input class="input" type="number" id="np-tm" placeholder="0" style="width:100%;direction:ltr"></div>
        <div><label>موجودی</label><input class="input" type="number" id="np-st" value="20" style="width:100%;direction:ltr"></div>
        <div><label>جنسیت</label><select class="sel" id="np-g" style="width:100%">
          <option value="a">هر دو</option><option value="m">مردانه</option><option value="f">زنانه</option></select></div>
        <div><label>رنگ اصلی</label><input class="input" type="color" id="np-c1" value="#1EBB8A" style="width:100%;height:36px;padding:3px"></div>
        <div><label>رنگ دوم</label><input class="input" type="color" id="np-c2" value="#D4AF37" style="width:100%;height:36px;padding:3px"></div>
        <div><label>سایزها (با ویرگول)</label><input class="input" id="np-sz" placeholder="S,M,L,XL" style="width:100%;direction:ltr"></div>
        <div><label>تصویر محصول (اختیاری)</label><input class="input" type="file" id="np-img" accept="image/*" style="width:100%;font-size:11px"></div>
        <div class="span2" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center;font-size:11.5px"><input type="checkbox" id="np-new"> برچسب «جدید»</label>
          <button class="btn sm" id="np-add">💾 افزودن محصول</button>
          <span style="font-size:11px;color:var(--muted)">شناسه به‌صورت خودکار ساخته می‌شود.</span>
        </div>
      </div>
    </div>

    <div class="glass">
      <div class="card-head"><span class="ic">📦</span><h3>لیست محصولات</h3>
        <select class="sel" id="af-cat" style="margin-right:auto;padding:5px 10px;font-size:11.5px">
          <option value="">همهٔ دسته‌ها</option>
          ${SLOT_OPTS().map(([id, n]) => `<option value="${id}" ${AFILT===id?'selected':''}>${esc(n)}</option>`).join('')}
        </select>
        <span class="tag">${fa(list.length)} مورد</span>
      </div>
      <div style="margin-top:10px">
        ${list.map(it => {
          const m = AV.itemMeta(it);
          return `<div class="asa-row" data-ir="${it.id}">
            <span class="th">${AV.itemPreviewSVG(it, 46)}</span>
            <span class="asa-col"><small>نام</small><input class="asa-in" data-f="n" value="${esc(it.n)}" style="width:170px"></span>
            <span class="asa-col"><small>دسته</small>
              <select class="asa-in" data-f="cat">${SLOT_OPTS().map(([id, n]) => `<option value="${id}" ${it.cat===id?'selected':''}>${esc(n)}</option>`).join('')}</select></span>
            <span class="asa-col"><small>برند</small>
              <select class="asa-in" data-f="b">${Object.entries(brands).map(([id, b]) => `<option value="${id}" ${it.b===id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></span>
            <span class="asa-col"><small>سکه</small><input class="asa-in" type="number" data-f="price" value="${+it.price||0}" style="width:74px;direction:ltr"></span>
            <span class="asa-col"><small>قبل تخفیف</small><input class="asa-in" type="number" data-f="disc" value="${m.disc||''}" style="width:80px;direction:ltr"></span>
            <span class="asa-col"><small>موجودی</small><input class="asa-in" type="number" data-f="stock" value="${m.stock}" style="width:70px;direction:ltr"></span>
            <span class="asa-col"><small>جنسیت</small><select class="asa-in" data-f="g">
              <option value="a" ${it.g==='a'?'selected':''}>هردو</option><option value="m" ${it.g==='m'?'selected':''}>آقا</option><option value="f" ${it.g==='f'?'selected':''}>خانم</option></select></span>
            <span class="asa-col"><small>رنگ‌ها</small><span style="display:flex;gap:3px">
              <input class="asa-in" type="color" data-f="c1" value="${/^#/.test(it.c1||'')?it.c1:'#8A93A6'}">
              <input class="asa-in" type="color" data-f="c2" value="${/^#/.test(it.c2||'')?it.c2:'#2A2F3A'}"></span></span>
            <button class="btn sm" data-isave="${it.id}">💾</button>
            <button class="btn sm danger" data-idel="${it.id}">🗑</button>
          </div>`;
        }).join('') || '<div style="color:var(--muted);font-size:12.5px;padding:10px">محصولی در این دسته نیست.</div>'}
      </div>
      <div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">
        <button class="btn sm ghost" id="asa-reset">♻️ بازگرداندن فروشگاه به حالت پیش‌فرض</button>
      </div>
    </div>`;

    const fc = $('#af-cat', body);
    if (fc) fc.addEventListener('change', () => { AFILT = fc.value; renderAdmin(root); });
    let imgData = '';
    const fi = $('#np-img', body);
    if (fi) fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { imgData = r.result; toast('تصویر بارگذاری شد ✓', 'green'); };
      r.readAsDataURL(f);
    });
    $('#np-add', body).addEventListener('click', () => {
      const n = $('#np-n', body).value.trim();
      if (!n){ toast('نام محصول را بنویسید', 'red'); return; }
      const id = 'x_' + Date.now().toString(36);
      const sizes = $('#np-sz', body).value.trim();
      AV.addShopItem({
        id, n, cat: $('#np-cat', body).value, b: $('#np-b', body).value,
        price: Math.max(0, +$('#np-p', body).value || 0),
        disc: +$('#np-disc', body).value || 0,
        toman: +$('#np-tm', body).value || 0,
        stock: +$('#np-st', body).value || 0,
        g: $('#np-g', body).value, c1: $('#np-c1', body).value, c2: $('#np-c2', body).value,
        sizes: sizes ? sizes.split(',').map(x => x.trim()) : [],
        tagNew: $('#np-new', body).checked, img: imgData || '',
        type: ['hat','glass','club','bag','ball','watch','glove'].includes($('#np-cat', body).value) ? 'custom' : undefined,
      });
      toast('محصول «' + n + '» به فروشگاه اضافه شد ✓', 'green');
      renderAdmin(root);
    });
    $$('[data-isave]', body).forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.asa-row');
      const g = f => { const el = row.querySelector(`[data-f="${f}"]`); return el ? el.value : ''; };
      AV.setShopItem(b.dataset.isave, {
        n: g('n'), cat: g('cat'), b: g('b'),
        price: Math.max(0, +g('price') || 0), disc: +g('disc') || 0,
        stock: +g('stock') || 0, g: g('g'), c1: g('c1'), c2: g('c2'),
      });
      toast('محصول ذخیره شد ✓', 'green');
      renderAdmin(root);
    }));
    $$('[data-idel]', body).forEach(b => b.addEventListener('click', () => {
      if (!confirm('این محصول از فروشگاه حذف شود؟')) return;
      AV.removeShopItem(b.dataset.idel);
      toast('محصول حذف شد 🗑', 'orange');
      renderAdmin(root);
    }));
    $('#asa-reset', body).addEventListener('click', () => {
      if (!confirm('همهٔ تغییرات فروشگاه (محصول/دسته/برند/بسته) پاک و به حالت اولیه برگردد؟')) return;
      AV.resetShop(); toast('فروشگاه بازنشانی شد', 'orange'); renderAdmin(root);
    });
  }

  function adminCats(body, root){
    const cats = AV.catsAll();
    body.innerHTML = `
    <div class="glass" style="margin-bottom:14px">
      <div class="card-head"><span class="ic">➕</span><h3>دستهٔ جدید</h3></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>عنوان دسته</label><input class="input" id="nc-n" style="width:100%" placeholder="مثلاً: پوشاک زمستانی"></div>
        <div><label>آیکن (ایموجی)</label><input class="input" id="nc-i" value="🏷️" style="width:100%"></div>
        <div><label>شناسه (لاتین)</label><input class="input" id="nc-id" style="width:100%;direction:ltr" placeholder="winter"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn sm" id="nc-add">💾 افزودن دسته</button></div>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🗂️</span><h3>دسته‌های فروشگاه</h3><span class="tag">${fa(cats.length)} دسته</span></div>
      <div style="margin-top:10px">
        ${cats.map(c => `<div class="asa-row">
          <span style="font-size:18px">${esc(c.icon || (VIEW_CATS.find(v => v.id === c.id) || {}).ic || '🏷️')}</span>
          <b style="flex:1;font-size:12.5px">${esc(c.label)}</b>
          <span style="font-size:10.5px;color:var(--muted);direction:ltr">${esc(c.id)}</span>
          <span style="font-size:10.5px;color:var(--muted)">${c.base ? 'پایه' : 'سفارشی'}</span>
          <label class="switch"><input type="checkbox" data-con="${c.id}" ${c.off ? '' : 'checked'}><span class="trk"></span></label>
          ${c.base ? '' : `<button class="btn sm danger" data-cdel2="${c.id}">🗑</button>`}
        </div>`).join('')}
      </div>
    </div>`;
    $('#nc-add', body).addEventListener('click', () => {
      const n = $('#nc-n', body).value.trim();
      const id = ($('#nc-id', body).value.trim() || 'c' + Date.now().toString(36)).replace(/[^a-z0-9_]/gi, '');
      if (!n){ toast('عنوان دسته را بنویسید', 'red'); return; }
      AV.addCat({ id, label: n, icon: $('#nc-i', body).value.trim() || '🏷️' });
      toast('دستهٔ «' + n + '» اضافه شد ✓', 'green');
      renderAdmin(root);
    });
    $$('[data-con]', body).forEach(ch => ch.addEventListener('change', () => {
      AV.setCat(ch.dataset.con, { off: !ch.checked });
      toast(ch.checked ? 'دسته نمایش داده می‌شود ✓' : 'دسته پنهان شد', ch.checked ? 'green' : 'orange');
    }));
    $$('[data-cdel2]', body).forEach(b => b.addEventListener('click', () => {
      if (!confirm('این دسته حذف شود؟')) return;
      AV.removeCat(b.dataset.cdel2); renderAdmin(root);
    }));
  }

  function adminBrands(body, root){
    const brands = AV.brands();
    body.innerHTML = `
    <div class="glass" style="margin-bottom:14px">
      <div class="card-head"><span class="ic">➕</span><h3>برند جدید</h3></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>نام برند</label><input class="input" id="nb-n" style="width:100%;direction:ltr" placeholder="Cobra Golf"></div>
        <div><label>شناسه (لاتین)</label><input class="input" id="nb-id" style="width:100%;direction:ltr" placeholder="cobra2"></div>
        <div><label>رده</label><input class="input" id="nb-t" value="میان‌رده" style="width:100%"></div>
        <div><label>رنگ برند</label><input class="input" type="color" id="nb-c" value="#1EBB8A" style="width:100%;height:36px;padding:3px"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn sm" id="nb-add">💾 افزودن برند</button></div>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🏷️</span><h3>برندهای فروشگاه</h3><span class="tag">${fa(Object.keys(brands).length)} برند</span></div>
      <div style="margin-top:10px">
        ${Object.entries(brands).map(([id, b]) => `<div class="asa-row" data-br="${id}">
          <span class="as-brand" style="color:${b.c};border-color:${b.c}55;background:${b.c}18">${esc(b.name)}</span>
          <span class="asa-col"><small>نام</small><input class="asa-in" data-f="name" value="${esc(b.name)}" style="width:170px;direction:ltr"></span>
          <span class="asa-col"><small>رده</small><input class="asa-in" data-f="tier" value="${esc(b.tier || '')}" style="width:110px"></span>
          <span class="asa-col"><small>رنگ</small><input class="asa-in" type="color" data-f="c" value="${/^#/.test(b.c||'')?b.c:'#8A93A6'}"></span>
          <span style="font-size:10.5px;color:var(--muted)">${fa(AV.shopAll().filter(i => i.b === id).length)} محصول</span>
          <button class="btn sm" data-bsave="${id}">💾</button>
        </div>`).join('')}
      </div>
    </div>`;
    $('#nb-add', body).addEventListener('click', () => {
      const n = $('#nb-n', body).value.trim();
      const id = ($('#nb-id', body).value.trim() || 'b' + Date.now().toString(36)).replace(/[^a-z0-9_]/gi, '');
      if (!n){ toast('نام برند را بنویسید', 'red'); return; }
      AV.setBrand(id, { name: n, tier: $('#nb-t', body).value.trim(), c: $('#nb-c', body).value });
      toast('برند «' + n + '» اضافه شد ✓', 'green');
      renderAdmin(root);
    });
    $$('[data-bsave]', body).forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.asa-row');
      const g = f => row.querySelector(`[data-f="${f}"]`).value;
      AV.setBrand(b.dataset.bsave, { name: g('name'), tier: g('tier'), c: g('c') });
      toast('برند ذخیره شد ✓', 'green'); renderAdmin(root);
    }));
  }

  function adminBundles(body, root){
    const all = AV.shop().filter(i => ['hair','eyes','skin'].indexOf(i.cat) === -1);
    const list = AV.bundlesAll();
    body.innerHTML = `
    <div class="glass" style="margin-bottom:14px">
      <div class="card-head"><span class="ic">🎁</span><h3>ساخت بستهٔ ویژه (استایل کامل)</h3></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>نام ست</label><input class="input" id="nu-bn" style="width:100%" placeholder="مثلاً: ست قهرمانی سبز"></div>
        <div><label>قیمت ست (سکه) — خالی = جمع آیتم‌ها</label><input class="input" type="number" id="nu-bp" style="width:100%;direction:ltr"></div>
        <div class="span2"><label>آیتم‌های ست (چندتایی — با Ctrl انتخاب کنید)</label>
          <select class="sel" id="nu-bi" multiple size="8" style="width:100%">
            ${all.map(i => `<option value="${i.id}">${esc((AV.CATS.find(c => c[0] === i.cat) || ['','?'])[1])} — ${esc(i.n)} (${fa(+i.price||0)} 🪙)</option>`).join('')}
          </select></div>
        <div style="display:flex;align-items:flex-end"><button class="btn sm" id="nu-badd">💾 ساخت بسته</button></div>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">📦</span><h3>بسته‌های ویژه</h3><span class="tag">${fa(list.length)} بسته</span></div>
      <div style="margin-top:10px">
        ${list.length ? list.map(b => {
          const items = (b.ids || []).map(id => AV.shopItem(id)).filter(Boolean);
          const sum = items.reduce((s, i) => s + (+i.price || 0), 0);
          return `<div class="asa-row">
            <span class="th">${items.slice(0,3).map(i => AV.itemPreviewSVG(i, 34)).join('')}</span>
            <span class="asa-col"><small>نام</small><input class="asa-in" data-bf="n" value="${esc(b.n)}" style="width:160px"></span>
            <span class="asa-col"><small>قیمت</small><input class="asa-in" type="number" data-bf="price" value="${+b.price || sum}" style="width:84px;direction:ltr"></span>
            <span style="flex:1;font-size:10.5px;color:var(--muted)">${items.map(i => esc(i.n)).join(' • ')} — جمع: ${fa(sum)} 🪙</span>
            <label class="switch"><input type="checkbox" data-bon="${b.id}" ${b.off ? '' : 'checked'}><span class="trk"></span></label>
            <button class="btn sm" data-bsv="${b.id}">💾</button>
            <button class="btn sm danger" data-bdl="${b.id}">🗑</button>
          </div>`;
        }).join('') : '<div style="color:var(--muted);font-size:12.5px;padding:10px">هنوز بسته‌ای ساخته نشده است.</div>'}
      </div>
    </div>`;
    $('#nu-badd', body).addEventListener('click', () => {
      const n = $('#nu-bn', body).value.trim();
      const ids = Array.from($('#nu-bi', body).selectedOptions).map(o => o.value);
      if (!n || !ids.length){ toast('نام ست و حداقل یک آیتم لازم است', 'red'); return; }
      AV.addBundle({ id: 'bn_' + Date.now().toString(36), n, ids, price: +$('#nu-bp', body).value || 0 });
      toast('بستهٔ «' + n + '» ساخته شد ✓', 'green');
      renderAdmin(root);
    });
    $$('[data-bsv]', body).forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.asa-row');
      AV.setBundle(b.dataset.bsv, {
        n: row.querySelector('[data-bf="n"]').value,
        price: +row.querySelector('[data-bf="price"]').value || 0,
      });
      toast('بسته ذخیره شد ✓', 'green'); renderAdmin(root);
    }));
    $$('[data-bon]', body).forEach(ch => ch.addEventListener('change', () => AV.setBundle(ch.dataset.bon, { off: !ch.checked })));
    $$('[data-bdl]', body).forEach(b => b.addEventListener('click', () => {
      if (!confirm('این بسته حذف شود؟')) return;
      AV.removeBundle(b.dataset.bdl); renderAdmin(root);
    }));
  }

  window.SHOP = { renderShop, renderAdmin, itemModal, state: ST, VIEW_CATS, SLOTS };
})();
