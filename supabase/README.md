# ☁️ Supabase — همگام‌سازی ابری GolfAcademy PRO

لایهٔ همگام‌سازی: [`source/js/cloud.js`](../source/js/cloud.js) (بدون وابستگی، REST خالص)

## معماری فاز ۱

```
localStorage (ga_* keys)  ⇄  cloud.js (LWW, debounce 3s)  ⇄  PostgREST  ⇄  public.ga_store
```

- هر کلید `ga_*` (به‌جز لیست SKIP: `ga_session`, `ga_seed_v2`, `ga_cloud_*`) یک ردیف است:
  `k text PK | v jsonb | updated_at timestamptz` (ساختار موجود در پروژه؛ همانی که schema.sql می‌سازد)
- **Pull** هنگام باز شدن سایت: ردیف‌های تازه‌تر از آخرین همگام، روی localStorage اعمال می‌شود.
- **Push**: نگهبانِ `localStorage.setItem/removeItem` تغییرات را در صف کثیف
  (`ga_cloud_dirty`) ثبت می‌کند؛ ارسال debounced و همچنین هنگام `visibilitychange/hidden` و `beforeunload` (با `keepalive`).
- تعارض: **Last-Write-Wins** با `updated_at`. محدودیت‌ها در `docs/CLOUD_PLAN.md`.

## راه‌اندازی (یک‌باره)

1. پروژه: `https://iultwqtzvrysugfxwshw.supabase.co` (ref: `iultwqtzvrysugfxwshw`)
2. Dashboard → **SQL Editor** → محتوای [`schema.sql`](./schema.sql) را اجرا کنید (idempotent؛ چند بار اجرا مشکل‌ساز نیست).
3. Dashboard → **Settings → API Keys** → کلید **publishable** (`sb_publishable_…`)
   یا **anon legacy** (`eyJ…`) را کپی کنید.

> ⚠️ **هرگز** `service_role` / `secret` و رمز SQL را در فایل، چت یا ریپو قرار ندهید.
> کلید publishable/anon برای امبد شدن در سمت کلاینت طراحی شده (با فرض همین RLS).

## تنظیم کلید در سایت

سه راه (به ترتیب اولویت در `cloud.js`):

1. **پنل ☁️ گوشهٔ صفحه** — URL + کلید → «ذخیره و اعمال» (در `localStorage.ga_cloud_cfg` می‌نشیند؛ بدون redeploy).
2. **Console**: `GA_CLOUD.setCfg('https://<ref>.supabase.co', '<publishable key>', true)` سپس reload.
3. **Embed در باندل**: مقدار `DEF.key` در ابتدای `source/js/cloud.js` → `python3 source/build_standalone.py` → فقط خروجی پنل `GolfAcademy_PRO.html` را در ریشهٔ ریپو جایگزین و پوش کنید؛ `index.html` ریشه ویترین عمومی است و نباید بازنویسی شود.

## دیباگ

```js
GA_CLOUD.status()          // فاز، پیام، زمان آخرین همگام
GA_CLOUD.test()            // GET تستی روی ga_store: ok؟ 401؟ جدول نیست؟
GA_CLOUD.dirty()           // کلیدهای در صف ارسال
GA_CLOUD.pull(); GA_CLOUD.push('manual');
```

| نشانه | معنا |
|---|---|
| چیپ خاکستری | کانفیگ ناقص/خاموش |
| چیپ قرمز | خطای شبکه/401 — «تست اتصال» را بزنید |
| `401 Invalid API key` | کلید غلط/کات‌شده یا پروژهٔ دیگر |
| `PGRST205 Could not find the table` | `schema.sql` اجرا نشده |

## امنیت

- RLS روی `ga_store` فعال است و policy فاز ۱ («همه با کلید public») عمداً ساده است:
  دادهٔ نمایشی/تورنمنتی یک باشگاه. برای دادهٔ حساس‌تر، فاز ۲ نقش‌محور می‌شود.
- کلید لو‌رفته/نامعتبر را در Dashboard → API Keys **ریست** کنید (Roll new key) —
  سپس فقط باندل یا پنل را به‌روز کنید.

## تفاوت اتصال و ارسال

«تست اتصال» یک تست **خواندن** است. اگر موفق است ولی صف قرمز می‌ماند، پیام وضعیت ارسال و نام کلید خطادار را در پنجرهٔ ☁️ بررسی کنید؛ این وضعیت الزاماً قطعی دیتابیس نیست.

در نسخهٔ جدید، نوشتن تنها از Edge Function انجام می‌شود، خطای اصلی آن نمایش داده می‌شود و داده‌های ناموفق در صف می‌مانند. برای رفع این خطا `schema.sql` یا فرمان‌های تغییر مجوز را بی‌بررسی دوباره اجرا نکنید؛ بازکردن نوشتن عمومی یا حذف جدول راه‌حل صف ارسال نیست. تا ارسال تأیید نشده، داده‌های مرورگر را پاک نکنید. جزئیات و تست‌ها در `docs/CLOUD_PLAN.md` هستند.

## کلید حجیم `ga_academy` و انتشار تابع

برای خطای حجم حدود ۸۲۳KiB، کد پنل و `functions/ga-sync/index.ts` به سقف یکسان **۲MiB UTF-8** هماهنگ شده‌اند. تابع باید در خود Supabase منتشر شود؛ GitHub Pages فقط پنل را منتشر می‌کند. مراحل دقیق در [`docs/DEPLOY_GA_SYNC_SIZE.md`](../docs/DEPLOY_GA_SYNC_SIZE.md) است. تا انتشار نسخهٔ سرور، خطای 413 ممکن است باقی بماند و داده در صف حفظ می‌شود. هیچ جدول یا مجوز جدیدی لازم نیست.
