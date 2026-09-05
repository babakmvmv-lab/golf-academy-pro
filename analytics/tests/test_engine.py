# -*- coding: utf-8 -*-
"""تست‌های موتور — بدون شبکه اجرا می‌شوند."""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from core import registry  # noqa: E402
from core.models import Shot  # noqa: E402


def _fixture():
    shots = [
        Shot(sid="s1", pid=1, club="Iron 7", yds=140, res="straight", t=1),
        Shot(sid="s1", pid=1, club="Iron 7", yds=150, res="straight", t=2),
        Shot(sid="s1", pid=2, club="Driver", yds=230, res="slice", t=3),
        Shot(sid="s1", pid=1, club="Iron 7", yds=145, res="hook", t=4),
        Shot(sid="s1", pid=1, club="Driver", yds=210, res="miss", t=5),
        Shot(sid="s1", pid=1, club="Driver", yds=225, res="straight", t=6),
    ]
    config = json.loads((pathlib.Path(__file__).resolve().parent.parent / "config.json").read_text("utf-8"))
    return {"shots": shots, "sessions": {}, "config": config, "player_id": None}


def test_autodiscover_finds_modules():
    mods = registry.all_modules()
    ids = {m.id for m in mods}
    assert {"shot_dispersion", "club_distance", "recent_trend"} <= ids
    # ترتیب اجرا بر اساس order
    assert [m.order for m in mods] == sorted(m.order for m in mods)


def test_dispersion_math():
    m = registry.get("shot_dispersion")
    r = m.run(_fixture())
    assert r["overall"]["total"] == 6
    assert r["overall"]["results"]["straight"]["n"] == 3
    assert r["players"]["1"]["total"] == 5
    assert abs(r["overall"]["success_pct"] - 50.0) < 0.01


def test_club_distance_table():
    m = registry.get("club_distance")
    r = m.run(_fixture())
    p1 = {row["club"]: row for row in r["players"]["1"]}
    assert p1["Iron 7"]["shots"] == 3
    assert p1["Iron 7"]["avg_yds"] == 145.0
    assert p1["Driver"]["max_yds"] == 225
    assert r["unit"] == "yard"


def test_recent_trend_window_and_delta():
    m = registry.get("recent_trend")
    r = m.run(_fixture())
    p1 = r["players"]["1"]
    # آخرین کلاب بازیکن ۱ در دیتای نمونه Driver است
    assert p1["club"] == "Driver"
    assert p1["last_shot"]["yds"] == 225
    assert [pt["yds"] for pt in p1["series"]] == [210, 225]


def test_empty_data_is_safe():
    ctx = _fixture(); ctx["shots"] = []
    for mid in ("shot_dispersion", "club_distance", "recent_trend"):
        r = registry.get(mid).run(ctx)
        assert r is not None
    assert registry.get("recent_trend").run(ctx)["players"] == {}


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    ok = 0
    for fn in fns:
        fn(); ok += 1
        print(f"  ✔ {fn.__name__}")
    print(f"PASS — {ok}/{len(fns)} تست سبز")
