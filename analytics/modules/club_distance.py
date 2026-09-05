# -*- coding: utf-8 -*-
"""آمار فاصله به‌ازای هر کلاب: تعداد، میانگین، انحراف معیار، بیشینه و نرخ ضربهٔ موفق."""
from statistics import mean, pstdev

from core.base import AnalysisModule
from core.registry import register


@register
class ClubDistance(AnalysisModule):
    id = "club_distance"
    title_fa = "آمار فاصلهٔ هر کلاب (یارد)"
    order = 20

    def run(self, ctx):
        shots = ctx["shots"]
        config = ctx["config"]
        success_codes = {c for c, o in config["results"].items() if o.get("is_success")}
        known_clubs = config.get("clubs") or []

        def table(lst):
            rows = []
            for club, cs in self.by_club(lst).items():
                ys = [s.yds for s in cs]
                st = sum(1 for s in cs if s.res in success_codes)
                rows.append({
                    "club": club,
                    "known": (club in known_clubs) if known_clubs else True,
                    "shots": len(cs),
                    "avg_yds": round(mean(ys), 1),
                    "min_yds": round(min(ys), 1),
                    "max_yds": round(max(ys), 1),
                    "std_yds": round(pstdev(ys), 1) if len(ys) > 1 else 0.0,
                    "success_pct": self.pct(st, len(cs)),
                })
            rows.sort(key=lambda r: -r["shots"])
            return rows

        return {
            "unit": config["units"]["distance"],
            "overall": table(shots),
            "players": {str(pid): table(lst) for pid, lst in self.by_player(shots).items()},
        }
