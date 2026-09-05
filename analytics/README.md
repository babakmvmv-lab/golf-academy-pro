# 🧠 GolfAcademy Analytics Engine (Python)

موتور تحلیل سمت سرور/بیلد برای داده‌های «بازیکن هوشمند» (ثبت رکورد تمرین).

## اصول طراحی (طبق الزامات محصول)
- **Scalable / Modular / Extensible** — هیچ چیز hardcode نیست:
  - لیست کلاب‌ها، کدهای نتیجه، رنگ‌ها و آستانه‌ها در `config.json`
  - هر تحلیل = یک فایل مستقل در `modules/` که با دکوریتور `@register` خودش را معرفی می‌کند
  - افزودن تحلیل جدید = ساختن یک فایل جدید در `modules/` — بدون دست‌زدن به هسته
- **هر تحلیل یک ماژول مستقل** با امضای یکسان:  `run(ctx) -> dict`
- خروجی واحد: `analysis.json` (قابل نمایش در سایت یا بازنویسی در Supabase)

## اجرا
```bash
# خواندن مستقیم از Supabase (کلید به‌صورت خودکار از source/js/cloud.js یا env خوانده می‌شود)
python3 analytics/run.py --out out/analysis.json

# یا روی فایل اکسپورت محلی
python3 analytics/run.py --input shots.json --sessions sessions.json --out out/analysis.json

# فقط یک ماژول خاص
python3 analytics/run.py --module recent_trend

# بازنویسی نتیجه روی ابر (کلید ga_sp_analysis — سایت بعداً آن را می‌خواند)
python3 analytics/run.py --supabase-write
```
متغیرهای محیطی اختیاری: `SUPABASE_URL` و `SUPABASE_KEY`.

## افزودن تحلیل جدید (۳ قدم)
۱. فایل `modules/my_analysis.py` بسازید:
```python
from core.registry import register
from core.base import AnalysisModule

@register
class MyAnalysis(AnalysisModule):
    id = 'my_analysis'          # شناسهٔ یکتا
    title_fa = 'تحلیل من'       # عنوان فارسی
    order = 50                  # ترتیب اجرا (کمتر = زودتر)

    def run(self, ctx):
        shots = ctx['shots']            # list[Shot]
        config = ctx['config']          # config.json
        return {'players': {...}}
```
۲. هیچ — خودکار کشف می‌شود. ✅
۳. تست: `python3 -m pytest analytics/tests -q`

## مسیرهای توسعهٔ آینده (اسلات آماده)
- تحلیل‌های آماری پیشرفته (streaks، percentiles، Proximity-to-hole)
- مقایسهٔ بازیکنان (`modules/compare_players.py`)
- روند چندماهه/چندساله (`modules/season_trend.py`)
- تحلیل هوش مصنوعی (`modules/ai_insights.py` — رابط آماده، backend قابل‌تعویض)
- ورودی سنسور/لانچ‌مانیتور (`core/loader.py` + فرمت CSV Trackman/GCQuad)
- داشبورد مدیریتی: خروجی JSON همین‌جا خوراک نمودارهای سایت است.
