(function () {
  const CART_KEY = "pc_shop_cart";
  const $ = (s, r) => (r || document).querySelector(s);
  const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const toman = (n) => fa(Number(n || 0).toLocaleString("en-US")) + " تومان";

  function cart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveCart(list) { localStorage.setItem(CART_KEY, JSON.stringify(list)); paintCart(); }
  function addCart(p, qty) {
    const list = cart();
    const hit = list.find((x) => x.slug === p.slug);
    if (hit) hit.qty += qty || 1;
    else list.push({ slug: p.slug, name: p.name, price: p.price, image: (p.images || [])[0], qty: qty || 1 });
    saveCart(list);
    openCart();
  }
  function count() { return cart().reduce((s, i) => s + i.qty, 0); }

  function chrome() {
    const header = document.createElement("header");
    header.id = "site-header";
    header.innerHTML = `
      <a class="brand" href="index.html">
        <img src="site/images/academy-logo.jpg" alt="پات کلاب">
        <span>پات کلاب</span>
      </a>
      <nav class="desk">
        <a href="index.html">خانه</a>
        <a href="index.html#academy">آکادمی</a>
        <a href="shop.html">فروشگاه</a>
        <a href="index.html#contact">تماس</a>
      </nav>
      <div class="hdr-actions">
        <a id="enter-members" class="btn-gold" href="academy.html">ورود اعضای آکادمی</a>
        <button class="cart-btn" id="cart-open" aria-label="سبد">🛍<span id="cart-count" hidden>۰</span></button>
      </div>`;
    const foot = document.createElement("footer");
    foot.className = "site-footer";
    foot.innerHTML = `
      <div class="wrap foot-grid">
        <div>
          <strong class="gold-text">آکادمی گلف پات کلاب</strong>
          <p>اهواز — آموزش از مبتدی تا حرفه‌ای، فروشگاه تجهیزات اورجینال.</p>
        </div>
        <div>
          <a class="enter-members" href="academy.html">ورود اعضای آکادمی</a><br>
          <a href="shop.html">فروشگاه</a>
        </div>
        <div>
          <a href="tel:09369018285">۰۹۳۶۹۰۱۸۲۸۵</a><br>
          <a href="mailto:info@puttclub.ir">info@puttclub.ir</a><br>
          <a href="https://www.instagram.com/Puttclub.Golfacademy" rel="noopener">@Puttclub.Golfacademy</a>
        </div>
      </div>`;
    const root = document.getElementById("public-site");
    root.prepend(header);
    root.appendChild(foot);
    root.insertAdjacentHTML("beforeend", `
      <div id="cart-backdrop"></div>
      <aside id="cart-drawer">
        <h3>سبد خرید</h3>
        <div class="cart-lines" id="cart-lines"></div>
        <p id="cart-total"></p>
        <a class="btn-solid" href="checkout.html" style="margin-top:8px">تکمیل خرید</a>
      </aside>`);
    $("#cart-open").onclick = openCart;
    $("#cart-backdrop").onclick = closeCart;
    paintCart();
  }
  function openCart() { $("#cart-drawer").classList.add("open"); $("#cart-backdrop").classList.add("open"); paintCart(); }
  function closeCart() { $("#cart-drawer").classList.remove("open"); $("#cart-backdrop").classList.remove("open"); }
  function paintCart() {
    const n = count();
    const badge = $("#cart-count");
    if (badge) { badge.hidden = n === 0; badge.textContent = fa(n); }
    const lines = $("#cart-lines");
    if (!lines) return;
    const list = cart();
    if (!list.length) { lines.innerHTML = "<p class='muted'>سبد خالی است.</p>"; $("#cart-total").textContent = ""; return; }
    lines.innerHTML = list.map((i) => `
      <div class="cart-line">
        <img src="${i.image || ""}" alt="">
        <div><b>${i.name}</b><br><small>${fa(i.qty)} × ${toman(i.price)}</small></div>
        <button data-x="${i.slug}" style="background:none;border:0;color:var(--sage);cursor:pointer">حذف</button>
      </div>`).join("");
    lines.querySelectorAll("[data-x]").forEach((b) => {
      b.onclick = () => saveCart(cart().filter((x) => x.slug !== b.dataset.x));
    });
    $("#cart-total").textContent = "جمع: " + toman(list.reduce((s, i) => s + i.price * i.qty, 0));
  }

  async function catalog() {
    const r = await fetch("site/data/catalog.json");
    return r.json();
  }
  function card(p) {
    const img = (p.images && p.images[0]) || "";
    return `<a class="prod" href="product.html?slug=${encodeURIComponent(p.slug)}">
      <img src="${img}" alt="${p.name}">
      <div class="body">
        <div>${p.badge ? `<span class="badge">${p.badge}</span>` : ""}${p.isNew ? " <span class='badge'>جدید</span>" : ""}</div>
        <div class="cat">${p.category}</div>
        <b>${p.name}</b>
        <div><span class="price">${toman(p.price)}</span>${p.oldPrice ? `<span class="old">${toman(p.oldPrice)}</span>` : ""}</div>
      </div>
    </a>`;
  }

  async function home() {
    const box = $("#featured-grid");
    if (!box) return;
    const data = await catalog();
    box.innerHTML = data.products.filter((p) => p.isFeatured).map(card).join("");
  }

  async function shop() {
    const box = $("#shop-grid");
    if (!box) return;
    const data = await catalog();
    const cats = ["همه", ...data.categories.map((c) => c.name)];
    const bar = $("#shop-filters");
    let cur = "همه";
    function draw() {
      bar.innerHTML = cats.map((c) => `<button class="${c === cur ? "on" : ""}">${c}</button>`).join("");
      bar.querySelectorAll("button").forEach((b) => {
        b.onclick = () => { cur = b.textContent; draw(); };
      });
      const list = data.products.filter((p) => cur === "همه" || p.category === cur);
      box.innerHTML = list.map(card).join("");
    }
    draw();
  }

  async function product() {
    const mount = $("#product-root");
    if (!mount) return;
    const slug = new URLSearchParams(location.search).get("slug");
    const data = await catalog();
    const p = data.products.find((x) => x.slug === slug) || data.products[0];
    const img = (p.images && p.images[0]) || "";
    mount.innerHTML = `
      <img src="${img}" alt="${p.name}">
      <div>
        <p class="kicker">${p.category}</p>
        <h1>${p.name}</h1>
        <p class="price">${toman(p.price)}${p.oldPrice ? `<span class="old">${toman(p.oldPrice)}</span>` : ""}</p>
        <p class="muted">${p.description || p.shortDesc || ""}</p>
        <ul>${(p.features || []).map((f) => `<li>${f}</li>`).join("")}</ul>
        <button class="btn-solid" id="add-btn">افزودن به سبد</button>
      </div>`;
    $("#add-btn").onclick = () => addCart(p, 1);
  }

  function checkout() {
    const form = $("#checkout-form");
    if (!form) return;
    const list = cart();
    $("#checkout-sum").textContent = list.length
      ? list.map((i) => `${i.name} × ${fa(i.qty)}`).join("، ") + " — " + toman(list.reduce((s, i) => s + i.price * i.qty, 0))
      : "سبد خالی است.";
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!list.length) return;
      saveCart([]);
      form.innerHTML = "<p>سفارش شما ثبت شد (نمایشی). به‌زودی از طرف آکادمی تماس گرفته می‌شود.</p>";
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    chrome();
    home();
    shop();
    product();
    checkout();
  });
})();
