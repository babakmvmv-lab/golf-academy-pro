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
3. **Embed در باندل**: مقدار `DEF.key` در ابتدای `source/js/cloud.js` → `python3 source/build_standalone.py` → خروجی را در ریشهٔ ریپو (`index.html`, `GolfAcademy_PRO.html`) جایگزین و پوش کنید.

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
