# 📦 سند تحویل انتشار — GolfAcademy PRO (فاز ۱ ابری)

> **تاریخ:** ۱۴۰۵/۰۶/۱۱ — 2026-09-02  
> **کامیت مبنا روی `main`:** `acbde1e` (merge PR #6)  
> **سایت زنده (GitHub Pages، شاخهٔ `main` / مسیر `/`):** https://mvbabak556-bot.github.io/golf-academy-pro/

این سند «نقطهٔ تحویل» نسخهٔ فعلی است: چه چیزی منتشر شده، چطور تأیید شده،
چه چیزهایی آگاهانه باز مانده، و نفر بعدی از کجا شروع کند.
منبع حقیقتِ معماری ابری همچنان [`CLOUD_PLAN.md`](./CLOUD_PLAN.md) و
[`supabase/README.md`](../supabase/README.md) است؛ اینجا فقط وضعیت انتشار ثبت می‌شود.

---

## ۱) آنچه در این انتشار روی `main` است

تمام PRهای زیر با روش **merge commit** روی `main` رفته‌اند (بدون squash؛ تاریخچهٔ شاخه‌ها حفظ شده):

| PR | عنوان | زمان merge (UTC) |
|---|---|---|
| #1 | ✨ نبرد میدان‌ها: مدیریت کامل تیم‌ها و جدال‌های تیمی | 2026-09-02 06:22 |
| #2 | ساده‌سازی کارت ورود — حذف راهنمای رمز و زیرعنوان | 2026-09-02 08:14 |
| #3 | feat: اتصال به Supabase — لایهٔ همگام‌سازی ابری (فاز ۱) | 2026-09-02 11:41 |
| #4 | fix(cloud): امبد کلید کامل publishable | 2026-09-02 11:43 |
| #5 | fix(cloud): تطبیق با ساختار واقعی `ga_store` (`k/v/updated_at`) | 2026-09-02 11:47 |
| #6 | fix(cloud): احراز هویت فقط با `apikey` (هدر Bearer خراب‌شده حذف شد) | 2026-09-02 11:49 |

### خلاصهٔ تغییرات فنی (PR #3 تا #6)

- **`source/js/cloud.js`** — لایهٔ همگام‌سازی `localStorage ↔ Supabase`، بدون وابستگی، REST خالص (PostgREST):
  - نگهبان `Storage.prototype.setItem/removeItem` → صف کثیف `ga_cloud_dirty`، push با debounce ۳ ثانیه؛
  - جاروب ۲۰ ثانیه‌ای برای تغییراتی که از نگهبان رد شوند؛
  - `pull` در شروع جلسه با `limit=500`، تعارض **LWW** بر پایهٔ `updated_at`؛
  - حذف = tombstone `{__del:1}` (ردیف روی سرور می‌ماند تا دستگاه‌های دیگر آن را اعمال کنند);
  - flush هنگام `visibilitychange:hidden` / `beforeunload` (fetch `keepalive`) و هنگام `online`;
  - backoff نمایی در خطا (۵s → حداکثر ۱۲۰s);
  - پنل «☁️» و چیپ وضعیت **فقط برای کاربر واردشده** (`ga_session`) نمایش داده می‌شود؛
  - احراز هویت فقط با هدر `apikey` (PR #6) — کلید publishable در `DEF.key` امبد شده است.
- **`supabase/schema.sql`** — `public.ga_store (k text PK, v jsonb, updated_at timestamptz)` + RLS با policy باز فاز ۱ (`anon, authenticated` → `using(true) with check(true)`)؛ idempotent.
- **`supabase/README.md`** — راه‌اندازی، سه روش تنظیم کلید، جدول عیب‌یابی، نکات امنیتی.
- **`docs/CLOUD_PLAN.md`** — نقشهٔ فاز ۲ (جداول واقعی) و فاز ۳ (Auth، چندباشگاهی، Realtime).
- **`source/e2e/cloud_e2e.mjs`** — تست node-خالص با سرور PostgREST فیک (۱۳ ادعا).
- **`index.html` و `GolfAcademy_PRO.html`** — باندل تک‌فایلی بازسازی‌شده؛ `cloud.js` **اولین** اسکریپت است.

### ترتیب بارگذاری اسکریپت‌ها (باید در `source/index.html` و `build_standalone.py` یکسان بماند)

```
cloud → labels → holidays → data → charts → qrcode.min → battle → landing → jdate → avatar → shop → mgmt → app
```

---

## ۲) تأییدهای انجام‌شده (Evidence)

| مورد | نتیجه | نحوهٔ تأیید |
|---|---|---|
| تست واحد/e2e لایهٔ ابری | ✅ **PASS 13/13** | `node source/e2e/cloud_e2e.mjs` (node v22؛ بدون شبکه) |
| یکسان‌بودن دو خروجی باندل | ✅ | `cmp index.html GolfAcademy_PRO.html` — بایت‌به‌بایت برابر (۲٬۴۱۲ KB) |
| باندل ⇔ سورس | ✅ | هر ۱۳ فایل `source/js/*.js` و هر ۴ فایل `source/css/*.css` عیناً داخل باندل هستند؛ ۲۴ تصویر به data-URI تبدیل شده؛ **صفر** ارجاع خارجی (`src="http…"`) و **صفر** ارجاع باقی‌ماندهٔ `assets/…` |
| کلید امبدشده | ✅ | `sb_publishable_…` کامل (۴۶ کاراکتر) و در `cloud.js` و باندل یکسان است |
| احراز هویت با پروژهٔ زنده | ✅ (طبق PR #5/#6) | `GET /rest/v1/ga_store` با کلید public → **200** |
| Pages | ✅ `built` | منبع: شاخهٔ `main`، مسیر `/` |
| e2e مرورگری (`source/e2e/*.js`) | ⚠️ در این سشن اجرا نشد | نیاز به `playwright-core` + Chromium محلی (`EXE`)؛ در محیط sandbox موجود نبود |
| اسموک ابری روی سایت زنده در دو تب | ⚠️ توسط کاربر انجام شود | دستور در بخش ۴ |

> در sandbox این سشن دسترسی شبکه به Supabase/Pages وجود نداشت؛ به همین دلیل ردیف‌های
> «پروژهٔ زنده» به شواهد ثبت‌شده در PR #5 و #6 استناد می‌کنند، نه اجرای تازه.

---

## ۳) اسرار و پیکربندی

- تنها راز سمت کلاینت، **کلید publishable** است که برای امبد طراحی شده (`DEF.key` در `cloud.js`).
- **هرگز** `service_role` / `secret` / رمز SQL در ریپو، چت یا باندل قرار نگیرد.
- اگر کلید لو رفت یا باید عوض شود: Dashboard → **Settings → API Keys → Roll new key**؛ سپس یا
  `DEF.key` را عوض کرده و باندل را بازسازی/پوش کنید، یا بدون deploy از پنل ☁️ (`ga_cloud_cfg`) بازنویسی کنید.
- ⚠️ **نکتهٔ ابزاری:** در PR #6 مشخص شد الگوی `Bearer <token>` هنگام نوشتن فایل توسط ابزار
  به `***` تبدیل می‌شود. اگر لازم شد هدر `Authorization` برگردد، بعد از ویرایش، مقدار را
  با `grep -n "Authorization" source/js/cloud.js index.html` **بازبینی** کنید.

### پروژهٔ Supabase

- URL: `https://iultwqtzvrysugfxwshw.supabase.co` (ref: `iultwqtzvrysugfxwshw`)
- جدول: `public.ga_store` — ستون‌ها `k | v | updated_at` (به‌همین نام‌ها؛ نه `key/value`)
- کلیدهای همگام‌نشونده (SKIP): `ga_session`, `ga_seed_v2`, `ga_cloud_cfg`, `ga_cloud_dirty`, `ga_cloud_ts`, `__ga_t`

---

## ۴) چک‌لیست پس از انتشار (برای مالک محصول)

روی سایت زنده، با یک کاربر مدیر (`admin` / `golf1405`):

1. **تب A** — یک تغییر کوچک (مثلاً یک رویداد در تقویم) ثبت کنید → چیپ پایین‌چپ باید ظرف ~۳ ثانیه سبز و `synced` شود.
2. **تب B** (مرورگر/دستگاه دیگر) — refresh → تغییر باید دیده شود و toast «… کلید از ابر به‌روز شد» بیاید.
3. در کنسول: `GA_CLOUD.test().then(console.log)` → `{ ok: true, … }` و `GA_CLOUD.dirty()` → `[]`.
4. اگر چیپ **قرمز** بود: دکمهٔ «تست اتصال» در پنل ☁️ → پیام دقیق (۴۰۱ = کلید؛ PGRST205 = schema اجرا نشده).

اگر گام ۱–۳ برقرار باشد، «تعریف موفقیت فاز ۱» در `CLOUD_PLAN.md` محقق شده است.

---

## ۵) محدودیت‌های شناخته‌شده (آگاهانه، فاز ۱)

- **RLS باز است:** هر کسی با URL + کلید public می‌تواند `ga_store` را بخواند/بنویسد. برای دادهٔ نمایشی
  یک باشگاه پذیرفته شده؛ پیش از هر دادهٔ حساس، فاز ۲ (نقش‌محور) لازم است.
- **LWW فقط در سطح کلید:** ویرایش هم‌زمانِ یک رکورد در دو دستگاه → آخرین نوشتن برنده؛ ادغام فیلد‌به‌فیلد نداریم.
- **وابسته به ساعت دستگاه‌ها:** `updated_at` ساعت محلیِ نویسنده است؛ انحراف زیاد ساعت می‌تواند ترتیب LWW را خراب کند.
- **tombstoneها پاک نمی‌شوند:** ردیف‌های `{__del:1}` روی سرور می‌مانند (بی‌ضرر، ولی جدول را بزرگ می‌کنند).
- **سقف `limit=500`** در pull؛ برای یک باشگاه کافی است.
- **بدون Realtime:** تب‌های باز فقط با refresh یا pull دستی تازه می‌شوند.

---

## ۶) بازگشت (Rollback)

- **خاموش‌کردن فوری ابر بدون deploy:** پنل ☁️ → تیک «همگام‌سازی فعال باشد» را بردارید (یا `GA_CLOUD.setCfg(url, key, false)` + reload). داده‌های محلی دست‌نخورده می‌مانند.
- **بازگشت کد:** `git revert -m 1 <merge-sha>` روی `main` برای PR مورد نظر (SHAهای merge: #3 `8dc21e3`، #4 `78159d9`، #5 `d2d371d`، #6 `acbde1e`)؛ سپس باندل را بازسازی و پوش کنید. Pages خودکار از `main` دوباره منتشر می‌شود.
- **بازگشت داده:** جدول `ga_store` فقط آینه است؛ حذف کامل آن (`drop table`) دادهٔ محلی هیچ دستگاهی را پاک نمی‌کند — در اولین بازدید بعدی، دستگاه‌ها دوباره push می‌کنند.

---

## ۷) بازسازی باندل (برای هر تغییر بعدی)

```bash
cd source && python3 build_standalone.py        # نیاز به Pillow (pip install pillow)
cp GolfAcademy_PRO.html ../index.html
cp GolfAcademy_PRO.html ../GolfAcademy_PRO.html
node e2e/cloud_e2e.mjs                           # باید PASS 13/13 باشد
```

قبل از commit: `cmp index.html GolfAcademy_PRO.html` باید ساکت باشد و
`grep -c "GA_CLOUD" index.html` باید `>= 1` برگرداند (وگرنه نسخهٔ تک‌فایل بی‌ابر شده است).

---

## ۸) قدم بعدی پیشنهادی

فاز ۲ طبق `CLOUD_PLAN.md`: جداول نرمال (`id, data jsonb, updated_at`) با write-through از `ga_store`،
check constraints و RLS نقش‌محور (admin/member) با Supabase Auth. پیش‌نیاز عملی: تصمیم دربارهٔ
مدل هویت (OTP یا گذرواژه) چون لاگین فعلی کاملاً محلی است.
