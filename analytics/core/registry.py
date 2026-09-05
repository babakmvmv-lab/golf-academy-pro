# -*- coding: utf-8 -*-
"""رجیستری ماژول‌های تحلیل — کشف خودکار از پوشهٔ modules/.

افزودن فایل جدید در modules/ کافی است؛ هسته هرگز ویرایش نمی‌شود.
"""
import importlib.util
import pathlib
from typing import Dict, List, Type

from .base import AnalysisModule

REGISTRY: Dict[str, Type[AnalysisModule]] = {}


def register(cls: Type[AnalysisModule]) -> Type[AnalysisModule]:
    """دکوریتور ثبت ماژول تحلیل."""
    if not getattr(cls, "id", None) or cls.id == "base":
        raise ValueError(f"ماژول {cls.__name__} باید id یکتا داشته باشد")
    REGISTRY[cls.id] = cls
    return cls


def autodiscover(modules_dir: pathlib.Path) -> None:
    """هر فایل *.py در modules/ را ایمپورت می‌کند تا @register اجرا شود."""
    if not modules_dir.is_dir():
        return
    for f in sorted(modules_dir.glob("*.py")):
        if f.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(f"analytics_module_{f.stem}", f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # noqa: S102 — ماژول‌های داخلی خودمان هستند


def all_modules() -> List[AnalysisModule]:
    """نمونهٔ همهٔ ماژول‌ها، مرتب‌شده بر order."""
    autodiscover(pathlib.Path(__file__).resolve().parent.parent / "modules")
    return sorted((cls() for cls in REGISTRY.values()), key=lambda m: m.order)


def get(module_id: str) -> AnalysisModule:
    autodiscover(pathlib.Path(__file__).resolve().parent.parent / "modules")
    if module_id not in REGISTRY:
        raise KeyError(f"ماژول «{module_id}» ثبت نشده — موجود: {sorted(REGISTRY)}")
    return REGISTRY[module_id]()
