# -*- coding: utf-8 -*-
"""تحلیل پراکندگی نتایج ضربه — تعداد و درصد هر نتیجه، کلی و به‌ازای هر بازیکن."""
from core.base import AnalysisModule
from core.registry import register


@register
class ShotDispersion(AnalysisModule):
    id = "shot_dispersion"
    title_fa = "پراکندگی نتایج ضربه"
    order = 10

    def run(self, ctx):
        shots = ctx["shots"]
        results_cfg = ctx["config"]["results"]

        def stats(lst):
            out = {code: {"n": 0, "pct": 0.0, "fa": results_cfg.get(code, {}).get("fa", code),
                          "color": results_cfg.get(code, {}).get("color", "#888")}
                   for code in results_cfg}
            for s in lst:
                if s.res not in out:
                    out[s.res] = {"n": 0, "pct": 0.0, "fa": s.res, "color": "#888"}
                out[s.res]["n"] += 1
            n = len(lst)
            for code, o in out.items():
                o["pct"] = self.pct(o["n"], n)
            return {"total": n, "results": out,
                    "success_pct": self.pct(sum(o["n"] for c, o in out.items()
                                                if results_cfg.get(c, {}).get("is_success")), n)}

        players = {}
        for pid, lst in self.by_player(shots).items():
            players[str(pid)] = stats(lst)
        return {"overall": stats(shots), "players": players}
