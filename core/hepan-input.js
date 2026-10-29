/**
 * core/hepan-input.js —— 八字合盘的双人独立录入（1.6.0 新增）
 *
 * 审计要求（十）：
 *   1. 甲方、乙方分别具有完整独立状态：称呼、性别、历法类型（默认农历）、
 *      农历年/月/日、闰月开关、出生时辰（可选「不确定」）、换算后的公历日期。
 *   2. 使用现有 lunar-javascript 正确换算，不得使用近似公式。
 *   3. 年、月、日使用可验证的选择器，月与日选项根据所选农历年动态变化。
 *   4. 只有该年该月确为闰月时才能启用「闰月」。
 *   5. 非法日期不能提交，并显示明确原因。
 *   6. 内部同时保存用户原始历法输入和标准化公历时间，不得转换后丢失原始信息。
 *   7. 合盘结果页同时显示双方农历生日和换算后的公历生日。
 *   8. 未知时辰时只比较确定的年、月、日三柱，不得伪造时柱，
 *      也不得给出依赖时柱的确定结论。
 *   9. 甲乙双方不能共享日期、闰月或时辰状态，修改甲方不能改变乙方。
 *
 * 历法换算全部委托 lunar-javascript（或复用其封装的 lunar-input.js），不做近似推算。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../vendor/lunar.js'), require('../lunar-input.js'));
  } else {
    root.HepanInput = factory(
      { Solar: root.Solar, Lunar: root.Lunar, LunarUtil: root.LunarUtil },
      root.LunarInput
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LunarLib, LI) {
  'use strict';

  var Solar = LunarLib.Solar;
  var Lunar = LunarLib.Lunar;

  var CN_MONTH = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  var CN_DAY = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  var HOURS = [
    { v: -1, t: '时辰不确定' },
    { v: 0, t: '子时 23:00-01:00' }, { v: 2, t: '丑时 01:00-03:00' },
    { v: 4, t: '寅时 03:00-05:00' }, { v: 6, t: '卯时 05:00-07:00' },
    { v: 8, t: '辰时 07:00-09:00' }, { v: 10, t: '巳时 09:00-11:00' },
    { v: 12, t: '午时 11:00-13:00' }, { v: 14, t: '未时 13:00-15:00' },
    { v: 16, t: '申时 15:00-17:00' }, { v: 18, t: '酉时 17:00-19:00' },
    { v: 20, t: '戌时 19:00-21:00' }, { v: 22, t: '亥时 21:00-23:00' }
  ];

  var MIN_YEAR = 1900;
  var MAX_YEAR = 2100;

  /* ============================================================
   * 历法查询（供选择器使用）
   * ============================================================ */

  /** 某农历年的闰月月份号，无闰月返回 0 —— 委托 lunar-input.js */
  function leapMonthOf(lunarYear) {
    return LI.leapMonthOf(lunarYear) || 0;
  }

  /** 某农历年某月的天数 —— 委托 lunar-input.js */
  function monthDays(lunarYear, lunarMonth, isLeap) {
    return LI.lunarMonthDays(lunarYear, lunarMonth, !!isLeap);
  }

  /**
   * 某农历年的月份选项（动态含闰月）。
   * 审计要求：只有该年该月确为闰月时才生成闰月选项。
   */
  function monthOptions(lunarYear) {
    var out = [];
    var leap = leapMonthOf(lunarYear);
    for (var m = 1; m <= 12; m++) {
      out.push({ month: m, isLeap: false, label: CN_MONTH[m - 1] + '月', enabled: true });
      if (leap === m) {
        out.push({ month: m, isLeap: true, label: '闰' + CN_MONTH[m - 1] + '月', enabled: true });
      }
    }
    return out;
  }

  /**
   * 某农历年某月的日期选项（按实际天数动态生成）。
   */
  function dayOptions(lunarYear, lunarMonth, isLeap) {
    var n = monthDays(lunarYear, lunarMonth, isLeap);
    if (!n || n < 1) return [];
    var out = [];
    for (var d = 1; d <= n; d++) {
      out.push({ day: d, label: CN_DAY[d - 1] || String(d) });
    }
    return out;
  }

  /** 年份选项 */
  function yearOptions() {
    var out = [];
    for (var y = MIN_YEAR; y <= MAX_YEAR; y++) out.push({ year: y, label: y + '年' });
    return out;
  }

  /* ============================================================
   * 人员状态
   * ============================================================ */

  /**
   * 新建一个人的独立录入状态。
   * 默认历法为农历（审计要求）。
   */
  function newPerson(opt) {
    opt = opt || {};
    return {
      name: opt.name || '',
      gender: opt.gender || '男',
      calendarType: opt.calendarType || 'lunar',   // 默认农历
      lunarYear: opt.lunarYear || '',
      lunarMonth: opt.lunarMonth || '',
      lunarDay: opt.lunarDay || '',
      isLeap: !!opt.isLeap,
      hour: opt.hour === undefined ? -1 : opt.hour,
      // 公历直录（切成公历时使用）
      solarYear: opt.solarYear || '',
      solarMonth: opt.solarMonth || '',
      solarDay: opt.solarDay || ''
    };
  }

  /** 新建合盘状态：甲、乙双方完全独立 */
  function newState() {
    return {
      a: newPerson({ gender: '男' }),
      b: newPerson({ gender: '女' })
    };
  }

  /**
   * 更新某一方 —— 逐字段浅合并，绝不触碰另一方。
   * @param {object} st newState() 结果
   * @param {'a'|'b'} side
   * @param {object} patch
   */
  function setPerson(st, side, patch) {
    if (side !== 'a' && side !== 'b') throw new Error('side 必须为 a 或 b');
    var cur = st[side];
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'isLeap') cur.isLeap = !!patch.isLeap;
      else cur[k] = patch[k];
    });
    // 闰月开关：仅在该年该月确为闰月时生效
    if (cur.isLeap) {
      var leap = leapMonthOf(parseInt(cur.lunarYear, 10));
      if (leap !== parseInt(cur.lunarMonth, 10)) cur.isLeap = false;
    }
    // 日期越界自动回退到最后一天，避免出现该月不存在的日期
    var y = parseInt(cur.lunarYear, 10), m = parseInt(cur.lunarMonth, 10);
    var d = parseInt(cur.lunarDay, 10);
    if (y >= MIN_YEAR && y <= MAX_YEAR && m >= 1 && m <= 12 && d >= 1) {
      var maxD = monthDays(y, m, cur.isLeap);
      if (maxD > 0 && d > maxD) cur.lunarDay = maxD;
    }
    return cur;
  }

  /* ============================================================
   * 解析 / 换算
   * ============================================================ */

  /**
   * 把一个人的录入状态解析为可计算对象。
   * 失败时返回 { error }，成功时同时给出原始输入与标准化公历。
   */
  function resolvePerson(p) {
    if (!p) return { error: '未提供人员信息' };

    if (p.calendarType === 'solar') {
      return resolveSolar(p);
    }
    return resolveLunar(p);
  }

  function resolveLunar(p) {
    var y = parseInt(p.lunarYear, 10);
    var m = parseInt(p.lunarMonth, 10);
    var d = parseInt(p.lunarDay, 10);

    if (!y || !m || !d) {
      return { error: '请完整填写农历出生日期（年、月、日）' };
    }
    if (y < MIN_YEAR || y > MAX_YEAR) {
      return { error: '出生年份需在 ' + MIN_YEAR + ' 至 ' + MAX_YEAR + ' 之间，当前为 ' + y };
    }
    if (m < 1 || m > 12) {
      return { error: '农历月份需在 1 至 12 之间，当前为 ' + m };
    }
    // 闰月合法性
    if (p.isLeap) {
      var leap = leapMonthOf(y);
      if (leap !== m) {
        return {
          error: y + ' 年没有闰' + CN_MONTH[m - 1] + '月' +
            (leap ? '（该年闰' + CN_MONTH[leap - 1] + '月）' : '（该年无闰月）')
        };
      }
    }
    var maxD = monthDays(y, m, p.isLeap);
    if (maxD < 1) {
      return { error: '农历' + (p.isLeap ? '闰' : '') + CN_MONTH[m - 1] + '月不存在，请检查闰月设置' };
    }
    if (d < 1 || d > maxD) {
      return {
        error: '农历' + (p.isLeap ? '闰' : '') + CN_MONTH[m - 1] + '月没有' + d +
          '日（该月共 ' + maxD + ' 天），请检查日期'
      };
    }

    var lunar, solar;
    try {
      lunar = Lunar.fromYmdHms(y, p.isLeap ? -m : m, d, 0, 0, 0);
      solar = lunar.getSolar();
    } catch (e) {
      return { error: '该农历日期不存在，请检查：' + (e && e.message || e) };
    }

    var hourKnown = p.hour !== undefined && p.hour !== null && p.hour !== -1;
    return {
      name: p.name || '',
      gender: p.gender || '男',
      // 原始历法输入完整保留（审计要求：不得转换后丢失原始信息）
      rawInput: {
        calendarType: 'lunar',
        lunarYear: y, lunarMonth: m, lunarDay: d, isLeap: !!p.isLeap,
        hour: p.hour === undefined ? -1 : p.hour
      },
      // 标准化公历（未知时辰时不写 hour，避免伪造时柱）
      solar: {
        year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(),
        hour: hourKnown ? p.hour : null
      },
      hourKnown: hourKnown,
      pillarsAvailable: hourKnown ? 4 : 3,
      // 双方均需展示农历与公历
      lunarText: lunar.toString(),
      solarText: solar.getYear() + '年' + solar.getMonth() + '月' + solar.getDay() + '日' +
        (hourKnown ? ' ' + hourText(p.hour) : '（时辰未知）'),
      preview: '农历' + lunar.toString() + ' → 公历' + solar.getYear() + '年' +
        solar.getMonth() + '月' + solar.getDay() + '日',
      lunar: lunar,
      solarObj: solar
    };
  }

  function resolveSolar(p) {
    var y = parseInt(p.solarYear, 10);
    var m = parseInt(p.solarMonth, 10);
    var d = parseInt(p.solarDay, 10);
    if (!y || !m || !d) return { error: '请完整填写公历出生日期（年、月、日）' };
    if (y < MIN_YEAR || y > MAX_YEAR) {
      return { error: '出生年份需在 ' + MIN_YEAR + ' 至 ' + MAX_YEAR + ' 之间' };
    }
    var dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m < 1 || m > 12) return { error: '公历月份需在 1 至 12 之间' };
    if (d < 1 || d > dim[m - 1]) {
      return { error: '公历 ' + y + ' 年 ' + m + ' 月没有 ' + d + ' 日（该月共 ' + dim[m - 1] + ' 天）' };
    }
    var sol, lun;
    try {
      sol = Solar.fromYmd(y, m, d);
      lun = sol.getLunar();
    } catch (e) {
      return { error: '该公历日期不存在：' + (e && e.message || e) };
    }
    var hourKnown = p.hour !== undefined && p.hour !== null && p.hour !== -1;
    return {
      name: p.name || '',
      gender: p.gender || '男',
      rawInput: {
        calendarType: 'solar',
        solarYear: y, solarMonth: m, solarDay: d,
        hour: p.hour === undefined ? -1 : p.hour
      },
      solar: {
        year: y, month: m, day: d,
        hour: hourKnown ? p.hour : null
      },
      hourKnown: hourKnown,
      pillarsAvailable: hourKnown ? 4 : 3,
      lunarText: lun.toString(),
      solarText: y + '年' + m + '月' + d + '日' + (hourKnown ? ' ' + hourText(p.hour) : '（时辰未知）'),
      preview: '公历' + y + '年' + m + '月' + d + '日 → 农历' + lun.toString(),
      lunar: lun,
      solarObj: sol
    };
  }

  function hourText(h) {
    var hit = HOURS.filter(function (x) { return x.v === h; })[0];
    return hit ? hit.t : '';
  }

  /**
   * 校验整个合盘状态是否可提交。
   * @returns {{ok:boolean, errors:{a?:string,b?:string}}}
   */
  function validateState(st) {
    var ra = resolvePerson(st.a);
    var rb = resolvePerson(st.b);
    var errors = {};
    if (ra.error) errors.a = ra.error;
    if (rb.error) errors.b = rb.error;
    return { ok: !ra.error && !rb.error, errors: errors, ra: ra, rb: rb };
  }

  /**
   * 生成供结果页使用的生日对照（审计要求：同时显示农历与公历）。
   */
  function birthdayPair(resolved) {
    return {
      name: resolved.name,
      gender: resolved.gender,
      lunarText: resolved.lunarText,
      solarText: resolved.solarText,
      hourKnown: resolved.hourKnown,
      pillarsAvailable: resolved.pillarsAvailable,
      rawInput: resolved.rawInput
    };
  }

  return {
    MIN_YEAR: MIN_YEAR,
    MAX_YEAR: MAX_YEAR,
    HOURS: HOURS,
    CN_MONTH: CN_MONTH,
    CN_DAY: CN_DAY,

    leapMonthOf: leapMonthOf,
    monthDays: monthDays,
    monthOptions: monthOptions,
    dayOptions: dayOptions,
    yearOptions: yearOptions,

    newPerson: newPerson,
    newState: newState,
    setPerson: setPerson,

    resolvePerson: resolvePerson,
    validateState: validateState,
    birthdayPair: birthdayPair,
    hourText: hourText
  };
});
