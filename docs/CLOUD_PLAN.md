# 🗺️ نقشهٔ راه — همگام‌سازی ابری (Cloud Plan)

هدف: GolfAcademy PRO یک تک‌فایل آفلاین است که داده‌اش در localStorage زنده است.
مرحلهٔ بعد: همان داده با یک **ابر مشترک** (Supabase) همگام شود تا
دستگاه‌های مربی/اعضا یک نسخهٔ واحد ببینند — بدون تغییر معماری UI و بدون فریمورک.

## فاز ۱ — آینهٔ KV روی `ga_store` ✅ (این نسخه)

- جدول تک‌ردیف‌به‌کلید: `k text PK | v jsonb | updated_at timestamptz`
- `cloud.js` بدون وابستگی: نگهبان setItem/removeItem + صف کثیف + جاروب ۲۰ ثانیه‌ای
  + flush هنگام مخفی/بسته‌شدن تب (fetch keepalive).
- تقابل LWW بر پایهٔ `updated_at`؛ ستون ساعتِ نوشتنِ محلی است
  (ساعت دستگاه‌ها باید به‌طور معقولی همگام باشد).
- پیکربندی: embed در باندل + بازنویسی runtime با `ga_cloud_cfg` / پنل ☁️.
- محدودیت‌های آگاهانهٔ فاز ۱:
  - هم‌زمانی هم‌زمان (ویرایش هم‌زمان یک رکورد) → آخرین نوشتن برنده؛ ادغام فیلد‌به‌فیلد ندارد.
  - حذف‌ها tombstone ساده‌اند (ردیف DELETE می‌شود؛ اگر بین two-فاز بمیری، ردیف `__del` در pull بعدی پاک‌سازی می‌شود).
  - سقف `limit=500` ردیف در pull برای یک باشگاه کافی است.

## فاز ۲ — جداول واقعی و اعتبارسنجی سرور

- مهاجرت `ga_players / ga_results / ga_tournaments / ga_coins / …` به
  جداول نرمال (id, data jsonb, updated_at) + view‌های PostgREST.
- `value` در `ga_store` به‌عنوان «cache» می‌ماند؛ write-through به جداول.
- Check constraints + RLS بر اساس نقش (admin/member) با Supabase Auth.

## فاز ۳ — هویت و چندباشگاهی

- Supabase Auth (OTP/گذرواژه) به‌جای لاگین محلی فعلی؛ `club_id` روی هر ردیف.
- RLS پیشرفته: سیاست‌ها بر اساس `auth.uid()` و عضویت باشگاه.
- Realtime: `supabase_realtime` publish روی `ga_store` → بدون polling تازه‌ماندن تب‌ها.

## همگام در بیلد/CI

- `source/build_standalone.py` لیست اسکریپت‌ها + `source/index.html` تگ
  `<script src="js/cloud.js">` — فراموش نشود، وگرنه نسخهٔ تک‌فایل بی‌ابر می‌شود.
- تست دود ابری: بازکردن سایت زنده در تب تازه (سیدِ اولیه ⇒ push خودکار)
  و سپس `GET /rest/v1/ga_store?select=k&limit=10` با کلید public — ردیف‌های `ga_*`
  باید دیده شوند؛ `GA_CLOUD.test()` هم در کنسول در دسترس است.

## تعریف موفقیت فاز ۱

روی سایت زنده (Pages)، در دو تب:
۱) تغییر در تقویم/نتایج در تب A ← چیپ سبز `synced`؛
۲) refresh در تب B ← تغییر دیده می‌شود؛
۳) `GA_CLOUD.test().then(console.log)` → `ok: true`.
