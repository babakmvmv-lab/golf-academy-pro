/* jalaali-js 2.0.1, MIT — local Persian calendar utility. */
var GOLF_DATE = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // ../.cache/golf-shop-qa/node_modules/jalaali-js/dist/index.cjs
  var require_index = __commonJS({
    "../.cache/golf-shop-qa/node_modules/jalaali-js/dist/index.cjs"(exports) {
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      var BREAKS = [
        -61,
        9,
        38,
        199,
        426,
        686,
        756,
        818,
        1111,
        1181,
        1210,
        1635,
        2060,
        2097,
        2192,
        2262,
        2324,
        2394,
        2456,
        3178
      ];
      var MIN_JALAALI_YEAR = BREAKS[0];
      var MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;
      function toJalaali(gyOrDate, gm, gd) {
        if (gyOrDate instanceof Date) return d2j(g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()));
        return d2j(g2d(gyOrDate, gm, gd));
      }
      function toGregorian(jy, jm, jd) {
        return d2g(j2d(jy, jm, jd));
      }
      function isValidJalaaliDate(jy, jm, jd) {
        return jy >= MIN_JALAALI_YEAR && jy <= MAX_JALAALI_YEAR && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaaliMonthLength(jy, jm);
      }
      function isLeapJalaaliYear(jy) {
        return jalCalLeap(jy) === 0;
      }
      function jalaaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isLeapJalaaliYear(jy) ? 30 : 29;
      }
      function jalCal(jy) {
        const { gy, march, jump, n } = jalCalCore(jy);
        return {
          leap: leapFromCycle(jump, n),
          gy,
          march
        };
      }
      function jalCalShort(jy) {
        const { gy, march } = jalCalCore(jy);
        return {
          gy,
          march
        };
      }
      function j2d(jy, jm, jd) {
        const r = jalCalShort(jy);
        return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
      }
      var FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
      var LAST_JALAALI_JDN = j2d(MAX_JALAALI_YEAR, 12, jalaaliMonthLength(MAX_JALAALI_YEAR, 12));
      function d2j(jdn) {
        if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) throw new RangeError(`Invalid Julian Day number ${jdn}: outside the supported Jalaali range [${MIN_JALAALI_YEAR}, ${MAX_JALAALI_YEAR}]`);
        const gy = d2g(jdn).gy;
        let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
        const r = jalCal(jy);
        let k = jdn - g2d(r.gy, 3, r.march);
        if (k >= 0) {
          if (k <= 185) return {
            jy,
            jm: 1 + div(k, 31),
            jd: mod(k, 31) + 1
          };
          k -= 186;
        } else {
          jy -= 1;
          k += 179;
          if (r.leap === 1) k += 1;
        }
        return {
          jy,
          jm: 7 + div(k, 30),
          jd: mod(k, 30) + 1
        };
      }
      function g2d(gy, gm, gd) {
        let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
        d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
        return d;
      }
      function d2g(jdn) {
        let j = 4 * jdn + 139361631;
        j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        const i = div(mod(j, 1461), 4) * 5 + 308;
        const gd = div(mod(i, 153), 5) + 1;
        const gm = mod(div(i, 153), 12) + 1;
        return {
          gy: div(j, 1461) - 100100 + div(8 - gm, 6),
          gm,
          gd
        };
      }
      function jalaaliToDateObject(jy, jm, jd, h = 0, m = 0, s = 0, ms = 0) {
        const g = toGregorian(jy, jm, jd);
        return new Date(g.gy, g.gm - 1, g.gd, h, m, s, ms);
      }
      function jalaaliWeek(jy, jm, jd) {
        const dayOfWeek = jalaaliToDateObject(jy, jm, jd).getDay();
        const startDayDifference = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
        const endDayDifference = 6 + startDayDifference;
        return {
          saturday: d2j(j2d(jy, jm, jd + startDayDifference)),
          friday: d2j(j2d(jy, jm, jd + endDayDifference))
        };
      }
      function jalCalCore(jy) {
        if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
        const gy = jy + 621;
        let leapJ = -14;
        let jp = BREAKS[0];
        let jm = 0;
        let jump = 0;
        for (let i = 1; i < BREAKS.length; i += 1) {
          jm = BREAKS[i];
          jump = jm - jp;
          if (jy < jm) break;
          leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
          jp = jm;
        }
        const n = jy - jp;
        leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
        if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
        const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
        return {
          gy,
          march: 20 + leapJ - leapG,
          jump,
          n
        };
      }
      function leapFromCycle(jump, n) {
        let adjusted = n;
        if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
        let leap = mod(mod(adjusted + 1, 33) - 1, 4);
        if (leap === -1) leap = 4;
        return leap;
      }
      function jalCalLeap(jy) {
        if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
        let jp = BREAKS[0];
        let jm = 0;
        let jump = 0;
        for (let i = 1; i < BREAKS.length; i += 1) {
          jm = BREAKS[i];
          jump = jm - jp;
          if (jy < jm) break;
          jp = jm;
        }
        return leapFromCycle(jump, jy - jp);
      }
      function div(a, b) {
        return ~~(a / b);
      }
      function mod(a, b) {
        return a - ~~(a / b) * b;
      }
      exports.MAX_JALAALI_YEAR = MAX_JALAALI_YEAR;
      exports.MIN_JALAALI_YEAR = MIN_JALAALI_YEAR;
      exports.d2g = d2g;
      exports.d2j = d2j;
      exports.g2d = g2d;
      exports.isLeapJalaaliYear = isLeapJalaaliYear;
      exports.isValidJalaaliDate = isValidJalaaliDate;
      exports.j2d = j2d;
      exports.jalCal = jalCal;
      exports.jalCalShort = jalCalShort;
      exports.jalaaliMonthLength = jalaaliMonthLength;
      exports.jalaaliToDateObject = jalaaliToDateObject;
      exports.jalaaliWeek = jalaaliWeek;
      exports.toGregorian = toGregorian;
      exports.toJalaali = toJalaali;
    }
  });
  return require_index();
})();
