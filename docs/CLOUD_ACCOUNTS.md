# حساب‌های ابری آکادمی و قفل ga_store (2026-10-07)

## خلاصه
| پیش‌تر | اکنون |
|---|---|
| یوزرها و رمزها فقط در `localStorage` هر دستگاه (`ga_users`، `ga_player_users`) | Supabase Auth + جدول `ga_accounts` (رمز فقط هش روی سرور) |
| روی دستگاه تازه `admin/golf1405` و … خودکار ساخته می‌شد | هیچ یوزر پیش‌فرضی ساخته نمی‌شود؛ ورود فقط با حساب ابری |
| `ga_store` برای همه قابل خواندن و نوشتن (anon) | نوشتن فقط از `ga-sync` با JWT؛ خواندن ناشناس فقط ۱۷ کلید عمومی |
| تابع `ga-mail` وجود نداشت | `ga-mail` (فقط مدیر؛ Resend یا EmailJS REST) |
| در هر بارگذاری چند نوشتن بیهوده (`ga_battle`، `ga_sp_*` و …) | پیش‌فرض‌های پیش از دریافت صف نمی‌شوند؛ سرور نوشتن هم‌مقدار را رد می‌کند |

## اجزا
- `supabase/ga_accounts.sql` — جدول `ga_accounts` و توابع `ga_is_member()` / `ga_is_admin()` (اعمال شده).
- `supabase/ga_store_lockdown.sql` و `supabase/ga_store_lockdown_rollback.sql` — قفل RLS و برگشت آن.
- `supabase/functions/ga-sync` — نقش از JWT: مدیر (adminpanel_access یا ga_accounts.role=admin) همهٔ کلیدها؛ عضو فقط
  `ga_msg_reads, ga_avatars, ga_cart, ga_fav, ga_coins, ga_coinreq` با ادغام «فقط سهم خودش» (بخش `POLICY-START…POLICY-END`).
  بدون JWT فقط وقتی secret `GA_SYNC_ALLOW_ANON=1` باشد (حالت گذار).
- `supabase/functions/ga-accounts` — فقط مدیر کنسول ادمین‌پنل: list/create/update/password/delete/bulk. حداقل رمز ۸.
  ایمیل داخلی هر یوزر: `<user>@members.puttclub.ir`.
- `supabase/functions/ga-mail` — ارسال ایمیل از سرور؛ به `RESEND_API_KEY` (+`MAIL_FROM`) یا فعال بودن
  «Allow EmailJS API for non-browser applications» در داشبورد EmailJS نیاز دارد.
- `source/js/auth.js` (`GA_AUTH`) — نشست در `pc_auth_v1`؛ در ادمین‌پنل هویت کنسول از `window.parent.__PUTT_ADMIN` (email + getToken).
- `source/js/cloud.js` — توکن کاربر روی همهٔ درخواست‌ها، `canWrite(k)` بر اساس نقش، محافظ «پیش‌فرض قبل از دریافت».

## مدیریت رمزها
رمزهای قبلی دستگاه‌ها مهاجرت داده نشدند (انتخاب مالک: `admin_reset`). مدیر اصلی از «مدیریت ← یوزرها» در ادمین‌پنل رمز هر عضو را تعیین می‌کند.

## تست‌ها
- `node source/e2e/ga_sync_policy_test.cjs` — منطق سیاست عضو در ga-sync (به `typescript@5` در NODE_PATH؛ وگرنه حالت regex).
- `node source/e2e/cloud_auth_e2e.cjs` — مرورگری و هرمتیک با `source/e2e/mock_cloud.cjs` (همهٔ میزبان‌های زنده abort می‌شوند).
- **مهم برای تست‌های مرورگری قدیمی:** تست‌هایی که با `admin/golf1405` وارد می‌شدند دیگر کار نمی‌کنند (یوزر پیش‌فرض حذف شد).
  برای آن‌ها از `createMockCloud({ accounts:[…] }).attach(context, html)` استفاده کنید.

## پس از قفل (lockdown)
- خواندن مستقیم کلیدهای خصوصی ga_store بدون JWT خالی برمی‌گردد و نوشتن مستقیم REST رد می‌شود؛ `analytics/run.py --supabase-write` (آپسرت مستقیم `ga_sp_analysis`) فقط با کلید service-role در محیط محلی (`~/.secrets`، هرگز در مرورگر/ریپو) کار می‌کند.
- برگشت اضطراری: `supabase/ga_store_lockdown_rollback.sql` و دوباره گذاشتن secret `GA_SYNC_ALLOW_ANON=1`.
