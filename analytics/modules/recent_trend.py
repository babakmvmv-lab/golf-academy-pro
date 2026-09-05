# -*- coding: utf-8 -*-
"""روند اخیر — آخرین ضربه‌های هر بازیکن برای «آخرین کلاب استفاده‌شده»
(همان دیتایی است که نمودار زندهٔ «بازیکن هوشمند» در سایت رسم می‌کند؛ اینجا
نسخهٔ سمت سرور با میانگین متحرک و دلتای بهبود هم محاسبه می‌شود)."""
from core.base import AnalysisModule
from core.registry import register


@register
class RecentTrend(AnalysisModule):
    id = "recent_trend"
    title_fa = "روند اخیر بازیکن بر اساس آخرین کلاب"
    order = 30

    def run(self, ctx):
        shots = ctx["shots"]
        cfg = ctx["config"]["thresholds"]
        window = int(cfg.get("recent_window", 15))
        ma_w = int(cfg.get("trend_ma_window", 5))

        out = {}
        for pid, lst in self.by_player(shots).items():
            lst = sorted(lst, key=lambda s: s.t)
            last = lst[-1] if lst else None
            if not last:
                continue
            series = [s for s in lst if s.club == last.club][-window:]
            ys = [s.yds for s in series]

            def ma(vals, w):
                return [round(sum(vals[max(0, i - w + 1):i + 1]) /
                              len(vals[max(0, i - w + 1):i + 1]), 1) for i in range(len(vals))]

            prev = [s.yds for s in lst if s.club == last.club][-2 * window:-window]
            delta = round((sum(ys) / len(ys)) - (sum(prev) / len(prev)), 1) if prev else None
            out[str(pid)] = {
                "club": last.club,
                "last_shot": {"yds": last.yds, "res": last.res, "t": last.t},
                "series": [{"i": i + 1, "yds": s.yds, "res": s.res} for i, s in enumerate(series)],
                "moving_avg": ma(ys, ma_w),
                "avg_yds": round(sum(ys) / len(ys), 1) if ys else 0,
                "delta_vs_prev_window": delta,   # بهبود/افت نسبت به پنجرهٔ قبلی (یارد)
            }
        return {"window": window, "unit": ctx["config"]["units"]["distance"], "players": out}
