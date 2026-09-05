#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اجرای موتور تحلیل — خروجی استاندارد: analysis.json

مثال‌ها:
    python3 analytics/run.py --out out/analysis.json
    python3 analytics/run.py --input shots.json --sessions sessions.json
    python3 analytics/run.py --module club_distance --player 7
    python3 analytics/run.py --supabase-write
"""
import argparse
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))   # core/ و modules/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from core import registry  # noqa: E402
from core.loader import load_data, _supabase_creds  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent


def load_config() -> dict:
    return json.loads((HERE / "config.json").read_text(encoding="utf-8"))


def write_back_supabase(payload: dict) -> None:
    """نتیجه را به‌صورت کلید ga_sp_analysis روی همان ga_store آپسرت می‌کند."""
    url, key = _supabase_creds()
    if not (url and key):
        raise RuntimeError("SUPABASE_URL/KEY در دسترس نیست")
    body = json.dumps([{
        "k": "ga_sp_analysis",
        "v": payload,
        "updated_at": payload["generated_at"],
    }]).encode("utf-8")
    req = urllib.request.Request(
        f"{url}/rest/v1/ga_store", data=body, method="POST",
        headers={"apikey": key, "Content-Type": "application/json",
                 "Prefer": "return=minimal,resolution=merge-duplicates"})
    with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310
        r.read()


def main() -> int:
    ap = argparse.ArgumentParser(description="GolfAcademy Analytics Engine")
    ap.add_argument("--input", help="فایل JSON ضربه‌ها (raw list)")
    ap.add_argument("--sessions", help="فایل JSON جلسات (raw object)")
    ap.add_argument("--module", help="فقط یک ماژول با id مشخص")
    ap.add_argument("--player", type=int, help="فیلتر روی یک بازیکن (pid)")
    ap.add_argument("--out", default="analytics/out/analysis.json")
    ap.add_argument("--supabase-write", action="store_true", help="آپسرت نتیجه روی ابر")
    args = ap.parse_args()

    config = load_config()
    shots, sessions = load_data(args.input, args.sessions)
    print(f"📥 داده: {len(shots)} ضربه / {len(sessions)} جلسه", file=sys.stderr)

    ctx = {"shots": shots, "sessions": sessions, "config": config,
           "player_id": args.player}

    mods = [registry.get(args.module)] if args.module else registry.all_modules()
    analyses = {}
    for m in mods:
        t0 = datetime.now()
        analyses[m.id] = {
            "title_fa": m.title_fa,
            "version": m.version,
            "duration_ms": None,
            "data": m.run(ctx),
        }
        analyses[m.id]["duration_ms"] = int((datetime.now() - t0).total_seconds() * 1000)
        print(f"  ✔ {m.id:16s} ({analyses[m.id]['duration_ms']}ms) — {m.title_fa}", file=sys.stderr)

    out_doc = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "golf-analytics/1",
        "counts": {"shots": len(shots), "sessions": len(sessions),
                   "modules": [m.id for m in mods]},
        "analyses": analyses,
    }
    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"💾 خروجی: {out_path} ({out_path.stat().st_size // 1024}KB)", file=sys.stderr)

    if args.supabase_write:
        write_back_supabase(out_doc)
        print("☁️ روی ابر آپسرت شد (ga_sp_analysis)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
