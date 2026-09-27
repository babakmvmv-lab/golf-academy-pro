# فایل‌های سنگین — روی گیت‌هاب هستند، اینجا نیستند

نقشه‌ها و باندل تکراری برای سبک ماندن ورک‌اسپیس skip-worktree شده‌اند.

وقتی زمین/نقشه لازم شد:

```
git update-index --no-skip-worktree mis_sat.jpg mis_topo.jpg
git checkout HEAD -- mis_sat.jpg mis_topo.jpg
```

باندل دوم (همان index.html):

```
git update-index --no-skip-worktree GolfAcademy_PRO.html
git checkout HEAD -- GolfAcademy_PRO.html
```
