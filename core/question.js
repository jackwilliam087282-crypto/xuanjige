/**
 * core/question.js —— 问题结构化与取用神
 *
 * 审计要求（三、7/8）：
 *   7. 具体问题先结构化为：事项大类、主体、对象、目标、期限、当前状态、
 *      是否涉及第三方。让用户确认后再按明确规则取用神。
 *      信息不足时输出「无法唯一取用」，不得生成确定成败和固定应期。
 *   8. 数字起卦必须在界面说明采用的具体公式与流派约定，
 *      不得把软件自定公式写成唯一古法。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QuestionStruct = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /**
   * 事项大类 → 默认用神五行
   * 说明：这是「本软件约定」的取用对照表，不是唯一古法。
   * 传统取用需以所占之神、问事类别、上下卦象综合论断，
   * 不同流派取法不一。此表在界面必须标注为软件约定。
   */
  var CATEGORY = {
    career: { label: '事业工作', yong: '木', liuqin: '官鬼', why: '官鬼为职位、名分、事业约束' },
    business: { label: '经商求财', yong: '土', liuqin: '妻财', why: '妻财为货物钱财' },
    wealth: { label: '财运求财', yong: '土', liuqin: '妻财', why: '妻财为货物钱财' },
    marriage: { label: '婚姻感情', yong: '木', liuqin: '妻财', why: '男问妻以妻财为用' },
    relationship: { label: '人际感情', yong: '木', liuqin: '兄弟', why: '兄弟为同辈、同行、朋友' },
    health: { label: '健康身体', yong: '火', liuqin: '子孙', why: '子孙为医药、解神' },
    study: { label: '学业考试', yong: '火', liuqin: '父母', why: '父母为文书、成绩' },
    litigation: { label: '官司诉讼', yong: '金', liuqin: '官鬼', why: '官鬼为官方、诉讼' },
    property: { label: '房产置业', yong: '土', liuqin: '父母', why: '父母为宅舍、契据' },
    travel: { label: '出行迁移', yong: '水', liuqin: '父母', why: '父母为舟车、路径' },
    children: { label: '子女子嗣', yong: '木', liuqin: '子孙', why: '子孙为后嗣' },
    lost: { label: '寻人失物', yong: '木', liuqin: '妻财', why: '失物看财爻，方向参世应' },
    fengshui: { label: '风水择居', yong: '土', liuqin: '父母', why: '父母为宅舍' },
    comprehensive: { label: '综合问事', yong: null, liuqin: null, why: '需先明确事项方能取用' },
  };

  var CATEGORY_KEYS = Object.keys(CATEGORY);

  /**
   * 关键词 → 事项大类（保守匹配，命中不了就归综合）
   * 只做明确词匹配，不做模糊猜测。
   */
  var KEYWORDS = [
    ['career', ['工作', '事业', '跳槽', '换工作', '升职', '晋升', '求职', '面试', 'offer', '公司', '岗位', '职业']],
    ['business', ['生意', '经商', '创业', '开店', '经营']],
    ['wealth', ['财', '钱', 'money', '收入', '薪资', '报酬', '利润', '赚', '投资', '股票']],
    ['marriage', ['婚', '恋爱', '对象', '女友', '男友', '妻', '夫', '结婚', '相亲', '感情']],
    ['relationship', ['朋友', '同事', '合作', '人际', '关系', '同学', '兄弟']],
    ['health', ['健康', '身体', '病', '疾', '手术', '医院', '医']],
    ['study', ['考试', '学业', '学习', '成绩', '考研', '高考', '录取', '论文']],
    ['litigation', ['官司', '诉讼', '起诉', '法院', '打官司', '纠纷', '仲裁']],
    ['property', ['房', '宅', '买房', '房产', '租房', '装修', '置业', '车']],
    ['travel', ['出行', '旅行', '搬家', '迁移', '出差', '远行', '行程']],
    ['children', ['孩子', '子女', '怀孕', '生育', '儿子', '女儿', '子嗣']],
    ['lost', ['丢', '失物', '寻人', '找回', '走失', '下落']],
    ['fengshui', ['风水', '择日', '方位', '选址', '朝向']],
  ];

  /**
   * 把问题原文结构化（仅作初步识别，必须交用户确认）
   * @param {string} raw 问题原文
   */
  function analyze(raw) {
    var text = String(raw || '');
    var category = 'comprehensive';
    var hits = [];
    for (var i = 0; i < KEYWORDS.length; i++) {
      var k = KEYWORDS[i][0], words = KEYWORDS[i][1];
      var found = words.filter(function (w) { return text.indexOf(w) >= 0; });
      if (found.length) { hits.push({ category: k, words: found }); }
    }
    if (hits.length) {
      // 命中多个时按关键词表顺序取第一个，并把全部命中交用户确认
      category = hits[0].category;
    }
    return {
      raw: text,
      category: category,
      categoryLabel: CATEGORY[category].label,
      candidateCategories: hits.map(function (h) { return h.category; }),
      subject: null,        // 主体：谁在问（本人/对方/双方）
      target: null,         // 对象
      goal: null,           // 目标
      deadline: null,       // 期限
      currentState: null,   // 当前状态
      hasThirdParty: null,  // 是否涉及第三方
      confirmed: false
    };
  }

  /**
   * 根据「用户确认后的问题结构」取用神。
   * 信息不足时返回 ambiguous=true，不给确定结论。
   * @param {object} qs analyze() 的结果，且 confirmed=true
   */
  function pickYong(qs) {
    if (!qs || !qs.confirmed) {
      return {
        ambiguous: true,
        yong: null,
        reason: '问题结构尚未经用户确认，按审计要求不得直接取用神'
      };
    }
    var cat = CATEGORY[qs.category];
    if (!cat) {
      return { ambiguous: true, yong: null, reason: '未识别到有效事项大类' };
    }
    if (!cat.yong) {
      return {
        ambiguous: true, yong: null,
        reason: '「' + cat.label + '」无法唯一取用：需先明确所问事项的具体对象，' +
          '否则六亲取用无唯一解（' + (qs.categoryLabel || cat.label) + '）'
      };
    }
    return {
      ambiguous: false,
      yong: cat.yong,
      liuqin: cat.liuqin,
      label: cat.label,
      reason: cat.why,
      source: 'convention',
      sourceNote: '取用对照表为本软件约定，非唯一古法；传统取用需参所占之神与卦象综合论断'
    };
  }

  /** 数字起卦的公式说明（必须在界面明示） */
  var NUMBER_FORMULA = {
    title: '数字起卦（本软件约定）',
    lines: [
      '单一数字 n（1~9999）：上卦 = (n ÷ 8 取余，余 0 作 8)，下卦 = (n ÷ 8 取整，若整除则减 1 后再取余，余 0 作 8)，动爻 = (n ÷ 6 取余，余 0 作 6)。',
      '两位数 ab：上卦 = (a + b) ÷ 8 取余，余 0 作 8；下卦 = (a + b + a) ÷ 8 取余，余 0 作 8；动爻 = (a + b) ÷ 6 取余，余 0 作 6。',
      '本公式为本软件的取象约定，界面不得表述为「古法唯一」。传统数字起卦（《梅花易数》）有多种取法，差异在于是否分用先天数、如何拆数。',
    ],
    convention: true
  };

  var TIME_FORMULA = {
    title: '时间起卦（《梅花易数》年月日时法）',
    lines: [
      '年支序：子 1 … 亥 12。',
      '上卦 = (年支序 + 农历月 + 农历日) ÷ 8 取余，余 0 作 8。',
      '下卦 = (年支序 + 农历月 + 农历日 + 时支序) ÷ 8 取余，余 0 作 8。',
      '动爻 = (年支序 + 农历月 + 农历日 + 时支序) ÷ 6 取余，余 0 作 6。',
      '动爻取值：阳爻动用老阳 9（阳变阴），阴爻动用老阴 6（阴变阳）。',
    ],
    source: '《梅花易数》以年月日时起卦；动爻阴阳取 9/6 为三钱法爻值的对应约定。'
  };

  return {
    CATEGORY: CATEGORY,
    CATEGORY_KEYS: CATEGORY_KEYS,
    analyze: analyze,
    pickYong: pickYong,
    NUMBER_FORMULA: NUMBER_FORMULA,
    TIME_FORMULA: TIME_FORMULA,
  };
});
