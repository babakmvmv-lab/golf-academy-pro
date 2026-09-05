# -*- coding: utf-8 -*-
"""مدل‌های داده‌ای مرکزی — منطبق بر ساختار ذخیره‌سازی کلاینت (ga_sp_*)"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Shot:
    sid: str          # شناسهٔ جلسه
    pid: int          # شناسهٔ بازیکن
    club: str         # نام کلاب (از config.clubs)
    yds: float        # فاصله — همیشه یارد
    res: str          # کد نتیجه (از config.results)
    t: int            # timestamp میلی‌ثانیه (epoch ms)

    @staticmethod
    def from_dict(d: dict) -> "Shot":
        return Shot(
            sid=str(d.get("sid", "")),
            pid=int(d.get("pid", 0)),
            club=str(d.get("club", "")),
            yds=float(d.get("yds", 0) or 0),
            res=str(d.get("res", "")),
            t=int(d.get("t", 0) or 0),
        )


@dataclass
class Session:
    id: str
    no: int
    type: str
    date_fa: str = ""
    created_at: str = ""
    closed_at: Optional[str] = None
    status: str = "open"          # open | closed

    @staticmethod
    def from_dict(d: dict) -> "Session":
        return Session(
            id=str(d.get("id", "")),
            no=int(d.get("no", 0) or 0),
            type=str(d.get("type", "")),
            date_fa=str(d.get("dateFa", d.get("date_fa", ""))),
            created_at=str(d.get("createdAt", d.get("created_at", ""))),
            closed_at=d.get("closedAt", d.get("closed_at")),
            status=str(d.get("status", "open")),
        )
