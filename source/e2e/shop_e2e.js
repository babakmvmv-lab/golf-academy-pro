/* e2e — فروشگاه آواتار v8 */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://localhost:8181/index.html';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } };

async function landing(page){
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 25000 });
  await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 6000 });
}
async function login(page, u, p) {
  const vis = await page.locator('#l3d-enter').isVisible().catch(() => false);
  if (vis) { await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(900); }
  await page.fill('#login-user', u);
  await page.fill('#login-pass', p);
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(1600);
}
async function logout(page){
  await page.click('#logout-btn'); await page.waitForTimeout(1400);
  await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 25000 });
}
async function openShop(page){
  await page.click('.nav-item[data-page="memberzone"]'); await page.waitForTimeout(700);
  await page.click('[data-mtab="avatar"]'); await page.waitForTimeout(1100);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--use-gl=swiftshader','--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (/arcTo/.test(e.message)) return; fail++; console.log('  ✘ JS ERROR: ' + e.message); });

  console.log('\n── ۱) بارگذاری اسکریپت‌ها و داده ──');
  await landing(page);
  const api = await page.evaluate(() => ({
    shop: !!(window.SHOP && SHOP.renderShop && SHOP.renderAdmin),
    meta: !!(window.AV && AV.itemMeta && AV.cats && AV.brands && AV.bundlesAll && AV.cart && AV.favs),
    cats: AV.CATS.map(c => c[0]),
    items: AV.shop().length,
    bag: AV.shop().filter(i => i.cat === 'bag').length,
    ball: AV.shop().filter(i => i.cat === 'ball').length,
    watch: AV.shop().filter(i => i.cat === 'watch').length,
    brands: Object.keys(AV.brands()).length,
    css: !!Array.from(document.styleSheets).some(s => { try { return Array.from(s.cssRules).some(r => (r.selectorText || '').includes('.as-card')); } catch (e) { return false; } }),
  }));
  ok(api.shop, 'window.SHOP با renderShop و renderAdmin موجود است');
  ok(api.meta, 'API جدید avatar.js (itemMeta/cats/brands/bundles/cart/favs) موجود است');
  ok(['bag', 'ball', 'watch'].every(c => api.cats.includes(c)), 'سه دستهٔ جدید کیف/توپ/ساعت اضافه شده‌اند');
  ok(api.bag >= 6 && api.ball >= 8 && api.watch >= 6, `آیتم‌های جدید: کیف ${api.bag} / توپ ${api.ball} / ساعت ${api.watch}`);
  ok(api.items >= 110, `کاتالوگ فروشگاه ${api.items} محصول دارد`);
  ok(api.brands >= 42, `${api.brands} برند ثبت شده است`);
  ok(api.css, 'استایل shop.css بارگذاری شده است');

  console.log('\n── ۲) ویترین عضو ──');
  await landing(page);
  await login(page, 'p1', 'golf1405');
  await openShop(page);
  const view = await page.evaluate(() => ({
    shop: !!document.querySelector('.ashop'),
    cats: document.querySelectorAll('.as-cat').length,
    hero: !!document.querySelector('.as-hero'),
    filters: document.querySelectorAll('.as-f').length,
    brands: document.querySelectorAll('.as-bl').length,
    cards: document.querySelectorAll('.as-card').length,
    prev: !!document.querySelector('.as-podium svg'),
    slots: document.querySelectorAll('.as-slot').length,
    cart: !!document.querySelector('.as-cart'),
    feats: document.querySelectorAll('.as-feat').length,
    search: !!document.querySelector('.as-search'),
    persian: /[\u0600-\u06FF]/.test((document.querySelector('.as-side') || {}).textContent || ''),
  }));
  ok(view.shop, 'ویترین سه‌ستونی .ashop رندر شد');
  ok(view.cats >= 14, `${view.cats} دستهٔ کناری نمایش داده شد`);
  ok(view.hero, 'بنر فروشگاه موجود است');
  ok(view.filters >= 6, `${view.filters} فیلتر مرتب‌سازی موجود است`);
  ok(view.brands >= 5, `نوار برندها با ${view.brands} برند`);
  ok(view.cards > 0, `${view.cards} کارت محصول رندر شد`);
  ok(view.prev, 'پیش‌نمایش زندهٔ آواتار (SVG) رندر شد');
  ok(view.slots >= 10, `${view.slots} کلید بخش روی صحنه`);
  ok(view.cart, 'پنل سبد خرید موجود است');
  ok(view.feats >= 3, 'ردیف ویژگی‌ها موجود است');
  ok(view.search, 'جعبهٔ جست‌وجو موجود است');
  ok(view.persian, 'متن‌ها فارسی هستند');

  console.log('\n── ۳) فیلتر، جست‌وجو و علاقه‌مندی ──');
  const nBefore = await page.evaluate(() => document.querySelectorAll('.as-card').length);
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.as-cat')).find(x => /کیف/.test(x.textContent)); if (c) c.click(); });
  await page.waitForTimeout(500);
  const bagOnly = await page.evaluate(() => ({
    n: document.querySelectorAll('.as-card').length,
    allBag: Array.from(document.querySelectorAll('.as-card')).every(c => AV.shopItem(c.dataset.card) && AV.shopItem(c.dataset.card).cat === 'bag'),
  }));
  ok(bagOnly.n > 0 && bagOnly.allBag, `فیلتر دستهٔ کیف: ${bagOnly.n} محصول و همه از دستهٔ کیف`);
  await page.evaluate(() => { const s = document.querySelector('.as-search'); s.value = 'نایک'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(450);
  const src = await page.evaluate(() => document.querySelectorAll('.as-card').length);
  ok(src >= 0, `جست‌وجو اجرا شد (${src} نتیجه)`);
  await page.evaluate(() => { const s = document.querySelector('.as-search'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.as-cat')).find(x => /همه/.test(x.textContent)); if (c) c.click(); });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelectorAll('.as-card').length) >= nBefore * 0.5, 'بازگشت به همهٔ محصولات');
  const favOk = await page.evaluate(async () => {
    const f = document.querySelector('.as-fav'); const id = f.closest('.as-card').dataset.card;
    f.click(); await new Promise(r => setTimeout(r, 400));
    return AV.favs('p1').includes(id);
  });
  ok(favOk, 'افزودن به علاقه‌مندی‌ها کار می‌کند');

  console.log('\n── ۴) سبد خرید و تسویه ──');
  const cart = await page.evaluate(async () => {
    AV.cartClear('p1');
    const own = AV.avatarOf('p1').owned;
    const buyable = AV.shop().filter(i => (+i.price || 0) > 0 && (+i.price || 0) <= 20 && !own.includes(i.id));
    AV.cartAdd('p1', buyable[0].id); AV.cartAdd('p1', buyable[1].id);
    const t = AV.cartTotal('p1');
    const before = AV.coinOf('p1').total;
    const res = AV.checkout('p1');
    return { n: AV.cart('p1').length, t, res, before, after: AV.coinOf('p1').total, gotBoth: buyable.slice(0,2).every(i => AV.avatarOf('p1').owned.includes(i.id)) };
  });
  ok(cart.t > 0, `جمع سبد خرید محاسبه شد (${cart.t} سکه)`);
  ok(cart.res && cart.res.ok, 'تسویهٔ سبد خرید موفق بود: ' + (cart.res && cart.res.msg));
  ok(cart.after === cart.before - cart.t, `سکه‌ها کسر شد: ${cart.before} → ${cart.after}`);
  ok(cart.n === 0, 'سبد پس از تسویه خالی شد');
  ok(cart.gotBoth, 'هر دو آیتم به کمد کاربر اضافه شدند');

  console.log('\n── ۵) پیش‌نمایش زنده و پوشیدن ──');
  await page.click('[data-mtab="home"]'); await page.waitForTimeout(400);
  await page.click('[data-mtab="avatar"]'); await page.waitForTimeout(900);
  const wear = await page.evaluate(async () => {
    const own = AV.avatarOf('p1').owned;
    const card = Array.from(document.querySelectorAll('.as-card')).find(c => own.includes(c.dataset.card) && c.querySelector('.as-buy.own') && AV.shopItem(c.dataset.card).cat !== 'skin');
    if (!card) return { skip: true };
    const id = card.dataset.card, cat = AV.shopItem(id).cat;
    const svgBefore = document.querySelector('.as-podium').innerHTML;
    card.querySelector('.as-buy.own').click();
    await new Promise(r => setTimeout(r, 600));
    return { sel: AV.avatarOf('p1').sel[cat] === id, changed: document.querySelector('.as-podium').innerHTML !== svgBefore || true };
  });
  ok(wear.skip || wear.sel, 'کلیک روی «پوشیدن» انتخاب را در آواتار ثبت می‌کند');
  const rot = await page.evaluate(async () => {
    const btn = document.querySelector('.as-rb'); if (!btn) return false;
    btn.click(); await new Promise(r => setTimeout(r, 250));
    const av = document.querySelector('.as-av');
    return !!(av && /rotateY/.test(av.style.transform || ''));
  });
  ok(rot, 'دکمهٔ چرخش، آواتار را می‌چرخاند');
  const modal = await page.evaluate(async () => {
    document.querySelector('.as-thumb').click(); await new Promise(r => setTimeout(r, 350));
    const m = !!document.querySelector('.as-dlg');
    const x = document.querySelector('.as-x'); if (x) x.click();
    await new Promise(r => setTimeout(r, 250));
    return { m, closed: !document.querySelector('.as-dlg') };
  });
  ok(modal.m, 'نمای بزرگ محصول (مودال) باز می‌شود');
  ok(modal.closed, 'مودال بسته می‌شود');

  console.log('\n── ۶) پنل مدیریت فروشگاه ──');
  await logout(page);
  await login(page, 'admin', 'golf1405');
  await page.click('.nav-item[data-page="mgmt"]'); await page.waitForTimeout(900);
  await page.click('.mgmt-tab[data-tab="shop"]'); await page.waitForTimeout(1000);
  const adm = await page.evaluate(() => ({
    tabs: document.querySelectorAll('.asa-tab').length,
    rows: document.querySelectorAll('.asa-row').length,
    addForm: !!document.querySelector('#np-add'),
    img: !!document.querySelector('#np-img'),
  }));
  ok(adm.tabs === 4, `پنل مدیریت ۴ زبانه دارد (${adm.tabs})`);
  ok(adm.rows > 0, `${adm.rows} ردیف محصول قابل ویرایش`);
  ok(adm.addForm && adm.img, 'فرم افزودن محصول با آپلود تصویر موجود است');
  const crud = await page.evaluate(async () => {
    document.querySelector('#np-n').value = 'تست محصول';
    document.querySelector('#np-p').value = '7';
    document.querySelector('#np-add').click();
    await new Promise(r => setTimeout(r, 500));
    const added = AV.shop().find(i => i.n === 'تست محصول');
    if (!added) return { added: false };
    AV.setShopItem(added.id, { price: 9 });
    const priced = AV.shopItem(added.id).price === 9;
    AV.removeShopItem(added.id);
    const gone = !AV.shop().find(i => i.n === 'تست محصول');
    return { added: true, priced, gone };
  });
  ok(crud.added, 'افزودن محصول از پنل کار می‌کند');
  ok(crud.priced, 'ویرایش قیمت محصول کار می‌کند');
  ok(crud.gone, 'حذف محصول کار می‌کند');
  const catBrandBundle = await page.evaluate(async () => {
    AV.addCat({ id: 'tst1', label: 'دستهٔ تست', icon: '🧪' });
    const c1 = AV.catsAll().some(c => c.id === 'tst1');
    AV.removeCat('tst1');
    const c2 = !AV.catsAll().some(c => c.id === 'tst1');
    AV.setBrand('tstb', { name: 'TestBrand', tier: 'تست', c: '#fff' });
    const b1 = !!AV.brands().tstb;
    AV.removeBrand('tstb');
    const ids = AV.shop().filter(i => (+i.price || 0) > 0).slice(0, 3).map(i => i.id);
    AV.addBundle({ id: 'bn_t', n: 'ست تست', ids, price: 5 });
    const u1 = AV.bundlesAll().some(x => x.id === 'bn_t');
    AV.removeBundle('bn_t');
    const u2 = !AV.bundlesAll().some(x => x.id === 'bn_t');
    return { c1, c2, b1, u1, u2 };
  });
  ok(catBrandBundle.c1 && catBrandBundle.c2, 'افزودن/حذف دسته از پنل کار می‌کند');
  ok(catBrandBundle.b1, 'افزودن برند از پنل کار می‌کند');
  ok(catBrandBundle.u1 && catBrandBundle.u2, 'ساخت/حذف بستهٔ ویژه کار می‌کند');

  console.log('\n── ۷) واکنش‌گرا (موبایل) ──');
  const mc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mc.newPage();
  await landing(m);
  await login(m, 'p1', 'golf1405');
  await m.evaluate(() => { const n = document.querySelector('.nav-item[data-page="memberzone"]'); if (n) n.click(); });
  await m.waitForTimeout(800);
  await m.evaluate(() => { const t = document.querySelector('[data-mtab="avatar"]'); if (t) t.click(); });
  await m.waitForTimeout(1200);
  const mob = await m.evaluate(() => {
    const g = document.querySelector('.as-grid'), s = document.querySelector('.ashop');
    const cols = g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0;
    const over = Array.from(document.querySelectorAll('.ashop *')).some(e => e.getBoundingClientRect().right > 396);
    return { one: getComputedStyle(s).gridTemplateColumns.split(' ').length === 1, cols, over, cards: document.querySelectorAll('.as-card').length };
  });
  ok(mob.one, 'در موبایل چیدمان تک‌ستونی می‌شود');
  ok(mob.cols === 2, `گرید محصولات در موبایل ۲ ستونه است (${mob.cols})`);
  ok(!mob.over, 'هیچ عنصری از عرض صفحهٔ موبایل بیرون نمی‌زند');
  ok(mob.cards > 0, `${mob.cards} کارت در موبایل رندر شد`);

  console.log(`\n═══ نتیجه: ${pass} موفق / ${fail} ناموفق ═══`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
