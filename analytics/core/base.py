# -*- coding: utf-8 -*-
"""کلاس پایهٔ ماژول‌های تحلیل — هر تحلیل یک زیرکلاس مستقل است.

ctx (دیکشنری ورودی به run):
    shots:    list[Shot]         — همهٔ ضربه‌ها (مرتب‌شده بر زمان)
    sessions: dict[str, Session] — جلسات بر اساس شناسه
    config:   dict               — محتوای config.json
    player_id: int | None        — اگر تحلیل برای یک بازیکن خاص خواسته شده باشد
"""
from typing import Any, Dict, List, Optional

from .models import Shot, Session


class AnalysisModule:
    id: str = "base"
    title_fa: str = ""
    order: int = 100          # ترتیب اجرا (کمتر = زودتر)
    version: str = "1.0.0"

    def run(self, ctx: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    # ── ابزارهای مشترک در دسترس همهٔ ماژول‌ها ──
    @staticmethod
    def by_player(shots: List[Shot]) -> Dict[int, List[Shot]]:
        out: Dict[int, List[Shot]] = {}
        for s in shots:
            out.setdefault(s.pid, []).append(s)
        return out

    @staticmethod
    def by_club(shots: List[Shot]) -> Dict[str, List[Shot]]:
        out: Dict[str, List[Shot]] = {}
        for s in shots:
            out.setdefault(s.club, []).append(s)
        return out

    @staticmethod
    def pct(part: int, total: int) -> float:
        return round(part / max(1, total) * 1000) / 10
