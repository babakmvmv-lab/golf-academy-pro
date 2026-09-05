# -*- coding: utf-8 -*-
"""لودر داده — دو منبع:
   ۱) فایل JSON محلی (اکسپورت دستی)
   ۲) Supabase REST (کلیدهای ga_sp_sessions / ga_sp_shots از جدول ga_store)

واسهٔ یکسان به run.py می‌دهد: (list[Shot], dict[str, Session])
کلید API از env (SUPABASE_URL / SUPABASE_KEY) یا به‌صورت fallback از
DEF داخل source/js/cloud.js خوانده می‌شود (کلید publishable — فقط خواندنی).
"""
import json
import pathlib
import re
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from .models import Session, Shot

REPO = pathlib.Path(__file__).resolve().parent.parent.parent


def _from_json_file(path: Optional[str]) -> Any:
    if not path:
        return None
    p = pathlib.Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    return json.loads(p.read_text(encoding="utf-8"))


def _supabase_creds() -> Tuple[Optional[str], Optional[str]]:
    import os
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if url and key:
        return url, key
    # fallback: خواندن DEF از cloud.js (کلید publishable طراحی‌شده برای کلاینت)
    cloud_js = REPO / "source" / "js" / "cloud.js"
    if cloud_js.exists():
        t = cloud_js.read_text(encoding="utf-8")
        m_url = re.search(r"url:\s*'([^']+)'", t)
        m_key = re.search(r"key:\s*'([^']+)'", t)
        if m_url and m_key:
            return m_url.group(1), m_key.group(1)
    return url, key


def _rest_get(url: str, key: str, path_q: str) -> Any:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path_q}",
        headers={"apikey": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310 — url معتبر خودمان
        return json.loads(r.read().decode("utf-8"))


def load_data(
    shots_json: Optional[str] = None,
    sessions_json: Optional[str] = None,
) -> Tuple[List[Shot], Dict[str, Session]]:
    """داده را از فایل محلی یا Supabase می‌خواند و نرمال‌شده برمی‌گرداند."""
    shots_raw = _from_json_file(shots_json)
    ses_raw = _from_json_file(sessions_json)

    if shots_raw is None or ses_raw is None:
        url, key = _supabase_creds()
        if not (url and key):
            raise RuntimeError("نه فایل ورودی هست، نه اتصال Supabase (SUPABASE_URL/KEY)")
        rows = _rest_get(url, key, "ga_store?select=k,v&k=in.(ga_sp_shots,ga_sp_sessions)")
        kv = {r["k"]: r["v"] for r in rows}
        if shots_raw is None:
            shots_raw = kv.get("ga_sp_shots", [])
        if ses_raw is None:
            ses_raw = kv.get("ga_sp_sessions", {})

    shots = [Shot.from_dict(s) for s in (shots_raw or [])]
    shots.sort(key=lambda s: s.t)
    sessions = {k: Session.from_dict(v) for k, v in (ses_raw or {}).items()}
    return shots, sessions
