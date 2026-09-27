#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اثر انگشت پیام کاربر — ابزار اجرای قانون «عدم تکرار درخواست‌ها».

قانون (AGENTS.md): پیامی که «کل آن» عیناً با پیام قبلی یکسان باشد، احتمالاً از
کش آمده یا دوبار ارسال شده است و مجوز اجرای دوباره نیست. این ابزار همانندی را
به‌صورت قطعی و ماشینی تشخیص می‌دهد.

نرمال‌سازی عمداً حداقلی است (تا تکرارِ واقعی از کش/ارسال دوبار تشخیص داده شود و
پیامِ متفاوت به‌اشتباه تکرار تلقی نشود):
  - NFC یونی‌کد
  - یکسان‌سازی نویسه‌های عربی/فارسی: ي→ی ، ك→ک
  - فشرده‌سازی همهٔ فاصله‌ها (شامل خط جدید) به یک فاصلهٔ تکی + حذف فاصله‌های ابتدا/انتها
  - ZWNJ (نیم‌فاصله) و همهٔ نویسه‌های دیگر دست‌نخورده می‌مانند.

هر تفاوتی خارج از این موارد (حتی یک کلمه) یعنی پیام جدید است، نه تکرار.

استفاده:
    python3 tools/request_fingerprint.py message.txt
    cat message.txt | python3 tools/request_fingerprint.py
    python3 tools/request_fingerprint.py --log docs/REQUEST_LOG.md message.txt

خروجی: خط FP (اثر انگشت)، خط STATUS (duplicate|new) و در صورت تکرار، ردیف ثبت‌شده.
کد خروج: 0 = پیام جدید، 1 = تکراری (اجرا نکن؛ وضعیت را گزارش کن)، 2 = خطا.

ثبت: پس از پایان هر درخواست، اثر انگشت پیام به جدول docs/REQUEST_LOG.md اضافه می‌شود.
"""
import hashlib
import re
import sys
import unicodedata
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOG = REPO_ROOT / "docs" / "REQUEST_LOG.md"

# الگوی اثر انگشت در جدول: fp-<hex16>
FP_RE = re.compile(r"\bfp-([0-9a-f]{16})\b")
# الگوی ردیف نشانه‌گذاری‌شده در جدول برای استخراج وضعیت
ROW_RE = re.compile(r"^\|.*fp-([0-9a-f]{16}).*$", re.M)


def normalize(text: str) -> str:
    """نرمال‌سازی حداقلی برای مقایسهٔ همانندی کل پیام."""
    t = unicodedata.normalize("NFC", text)
    t = t.replace("\u064A", "\u06CC").replace("\u0643", "\u06A9")  # ي→ی، ك→ک
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def fingerprint(text: str) -> str:
    return "fp-" + hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()[:16]


def lookup(fp: str, log_path: Path):
    """اگر اثر انگشت در لاگ باشد، ردیف آن را برگردان (str) وگرنه None."""
    if not log_path.exists():
        return None
    for line in log_path.read_text(encoding="utf-8").splitlines():
        if fp in line and "|" in line:
            return line.strip()
    return None


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    log_path = Path(argv[argv.index("--log") + 1]) if "--log" in argv else DEFAULT_LOG

    if args:
        msg = Path(args[0]).read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        msg = sys.stdin.read()
    else:
        print(__doc__)
        return 2

    fp = fingerprint(msg)
    row = lookup(fp, log_path)
    print(f"FP {fp}")
    if row:
        print("STATUS duplicate — این پیام عیناً قبلاً ثبت شده؛ اجرا ممنوع، فقط وضعیت را گزارش کن (مگر درخواست صریح دوباره از مالک).")
        print(f"LOGGED {row}")
        return 1
    print("STATUS new — پیام تکراری نیست؛ فقط دلتای جدید را اجرا کن و پس از پایان، اثر انگشت را در docs/REQUEST_LOG.md ثبت کن.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # noqa: BLE001
        print(f"ERROR {e}", file=sys.stderr)
        sys.exit(2)
