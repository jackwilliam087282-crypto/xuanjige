/**
 * 视图辅助层（纯工具，无依赖）
 *
 * 重要：微信 WXML 的 {{ }} 表达式能力远弱于 JavaScript，不支持
 * 三元运算符（? :）、逻辑或（||）、逻辑取反（!）、严格相等（===）
 * 以及函数调用。模板中一旦使用，开发者工具「问题」面板会报编译错误。
 *
 * 约定：所有条件判断一律在各页面的 .js 中算好，模板中只输出简单字段。
 *
 * 本文件采用 UMD 封装，全部声明限制在闭包内，不污染全局作用域
 * （否则与页面脚本中的同名标识符冲突，会导致整页渲染空白）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ViewHelper = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /** 十二时辰文案 */
  var SHICHEN_NAME = {
    '-1': '时辰未知',
    '0': '子时', '2': '丑时', '4': '寅时', '6': '卯时', '8': '辰时',
    '10': '巳时', '12': '午时', '14': '未时', '16': '申时', '18': '酉时',
    '20': '戌时', '22': '亥时'
  };

  /** 星级字符串，如 4 → ★★★★☆ */
  function starString(n) {
    var s = '';
    var k = Math.max(0, Math.min(5, Number(n) || 0));
    for (var i = 0; i < 5; i++) s += i < k ? '★' : '☆';
    return s;
  }

  /** 由分数换算星级（1-5） */
  function scoreToStar(score) {
    var n = Number(score) || 0;
    if (n >= 85) return 5;
    if (n >= 70) return 4;
    if (n >= 55) return 3;
    if (n >= 40) return 2;
    return 1;
  }

  return {
    SHICHEN_NAME: SHICHEN_NAME,
    starString: starString,
    scoreToStar: scoreToStar
  };
});
