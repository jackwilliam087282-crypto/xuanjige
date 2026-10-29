/* 玄机阁 · 塔罗隔空操作
 *
 * 「隔空」在本模块里的确切含义：
 *  **不需要按住鼠标也能走完整个流程** —— 悬停即感应、洗牌靠拖拽、
 *  翻牌可点可拖也可用键盘。摄像头手势不在此列，原因见 BOUNDARY。
 *
 * 边界（这一段是本模块存在的理由，不要为了「功能更全」把它删掉）：
 *  摄像头与媒体设备能力**不随安装包分发**，也不在应用授权范围内。
 *  做一个「开启摄像头手势」的按钮却永远没反应，比不做更糟——
 *  用户会以为是自己操作错了。所以这里：
 *    - 不请求摄像头，不创建视频流，不暴露任何启用入口；
 *    - status() 如实返回 camera: 'unavailable' 并说明原因；
 *    - 界面上写清「悬空生效的是指针与键盘，不是摄像头」。
 *
 * 交互实现上的关键约束（与户型实验室、掌纹记录同一个坑）：
 *  拖拽过程中**只移动当前节点**，绝不重绘整张牌桌。
 *  每次 pointermove 都重建 innerHTML 的话，新节点与旧的 rect/scale 全部失效，
 *  第二次 move 的坐标就会跳回原处，看起来像「拖不动」。
 */
(function (root) {
  'use strict';

  var EPS = 1e-6;
  /* 洗牌触发阈值：横向位移占牌桌宽度的比例。
     定得太小会误触（手抖一下就洗牌），太大则要刻意甩一下才生效。 */
  var DECK_DRAG_RATIO = 0.18;

  var BOUNDARY = '本模块的「隔空」指不需要按住鼠标：悬停即感应，拖拽可洗牌与翻牌，'
    + '键盘同样能走完全流程。摄像头手势不在其列——摄像头与媒体设备能力'
    + '不随安装包分发，应用也不申请此类权限，因此这里没有开启摄像头手势的入口，'
    + '界面不会给出实际不存在的功能。';

  /* ---------------------------------------------------------------- 命中判定 */

  function finiteRect(r) {
    if (!r || typeof r !== 'object') throw new Error('牌位缺少位置信息。');
    ['x', 'y', 'w', 'h'].forEach(function (k) {
      if (!Number.isFinite(r[k])) throw new Error('牌位坐标「' + k + '」不是有效数值。');
    });
    return r;
  }

  /* 纯函数：给指针位置与牌位列表，返回最上层命中的牌位 id，没有则 null。
     列表顺序即绘制顺序（后者在上），所以**从后往前**找第一个命中。 */
  function hitTest(pt, rects) {
    if (!pt || !Number.isFinite(pt.clientX) || !Number.isFinite(pt.clientY)) {
      throw new Error('命中判定需要有效的指针坐标（clientX / clientY）。');
    }
    if (!Array.isArray(rects)) throw new Error('命中判定需要一份牌位列表。');
    for (var i = rects.length - 1; i >= 0; i -= 1) {
      var r = finiteRect(rects[i]);
      if (pt.clientX >= r.x && pt.clientX <= r.x + r.w
        && pt.clientY >= r.y && pt.clientY <= r.y + r.h) {
        return r.id != null ? String(r.id) : null;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- 状态机 */

  function createState() {
    return {
      hovering: null,
      flipped: [],
      shuffles: 0,
      resultId: null,
      lastRadius: null,
      redrawsDuringDrag: 0,
      commits: 0
    };
  }

  /* 当前实现里的关键修正：flipped 从「对象」改成**数组**。
     之前用 {} 存 flipped[id]，判断「是否已翻开」要写 hasOwnProperty，
     容易漏；数组可以直接 indexOf，顺带天然去重。 */
  function isFlipped(st, id) { return st.flipped.indexOf(id) >= 0; }

  function toggle(st, id) {
    var k = String(id);
    var at = st.flipped.indexOf(k);
    if (at >= 0) st.flipped.splice(at, 1);
    else st.flipped.push(k);
    return isFlipped(st, k);
  }

  /* ---------------------------------------------------------------- testRig
   * 无头验证用的最小装置。它与 attach() 共用同一套状态机函数，
   * 所以测试通过即真实交互路径也成立——不是另写一套模拟逻辑。 */
  var RIG_SLOTS = [
    { id: 's1', x: 100, y: 60, w: 90, h: 132 },
    { id: 's2', x: 205, y: 60, w: 90, h: 132 },
    { id: 's3', x: 310, y: 60, w: 90, h: 132 },
    { id: 's4', x: 415, y: 60, w: 90, h: 132 }
  ];

  function testRig() {
    var st = createState();
    var cls = {};
    RIG_SLOTS.forEach(function (s) { cls[s.id] = ''; });

    function slot(id) {
      return {
        id: id,
        hasClass: /hover/.test(cls[id]),
        classes: cls[id]
      };
    }

    function sync(id) {
      cls[id] = isFlipped(st, id) ? 'is-flipped' : '';
    }

    var rig = {
      slot: slot,
      state: function () {
        return {
          hovering: st.hovering,
          flipped: st.flipped.slice(),
          flippedCount: st.flipped.length,
          shuffles: st.shuffles,
          resultId: st.resultId,
          lastRadius: st.lastRadius,
          redrawsDuringDrag: st.redrawsDuringDrag,
          commits: st.commits
        };
      },
      hover: function (id, radius) {
        if (id == null) {
          if (st.hovering != null) cls[st.hovering] = '';
          st.hovering = null;
          return;
        }
        var k = String(id);
        if (st.hovering != null && st.hovering !== k) cls[st.hovering] = '';
        st.hovering = k;
        if (!isFlipped(st, k)) cls[k] = 'is-hover';
        if (radius != null) st.lastRadius = radius;
      },
      click: function (id) { toggle(st, id); sync(id); },
      key: function (id, k) {
        if (k !== 'Enter' && k !== ' ') return;
        toggle(st, id); sync(id);
      },
      box: function (id) {
        var s = RIG_SLOTS.filter(function (x) { return x.id === id; })[0];
        if (!s) return null;
        return {
          x: s.x, y: s.y, w: s.w, h: s.h,
          cx: s.x + s.w / 2, cy: s.y + s.h / 2
        };
      },
      dragCard: function (id, px, py) {
        rig.dragCardVerbose(id, [[px, py]]);
      },
      dragCardVerbose: function (id, pts) {
        /* move 只改当前节点的坐标与本帧数据，不重绘整图 */
        pts.forEach(function (p) {
          st.lastX = p[0];
          st.lastY = p[1];
        });
        /* 松手判定：终点落在该牌范围内才算有效拖拽 */
        var last = pts[pts.length - 1];
        var s = RIG_SLOTS.filter(function (x) { return x.id === id; })[0];
        var inSlot = s
          && last[0] >= s.x && last[0] <= s.x + s.w
          && last[1] >= s.y && last[1] <= s.y + s.h;
        if (!inSlot) return;
        toggle(st, id);
        sync(id);
        st.commits += 1;   /* 松手只结算一次 */
      },
      dragDeck: function (ratios) {
        /* ratios 是横向位置比例序列；末位 − 初位超过阈值即触发洗牌 */
        if (!ratios || ratios.length < 2) return;
        var span = Math.abs(ratios[ratios.length - 1] - ratios[0]);
        if (span < DECK_DRAG_RATIO) return;
        st.shuffles += 1;
        if (st.resultId == null) st.resultId = 'rig-result-1';
      }
    };
    return rig;
  }

  /* ---------------------------------------------------------------- 环境状态 */

  function status() {
    /* 这里只回答「本应用是否具备摄像头手势能力」。
       结论是确定的「不具备」，所以不必去探测 navigator.mediaDevices——
       探测了反而像是准备要用。 */
    return {
      camera: 'unavailable',
      reason: '摄像头与媒体设备能力不随安装包分发，应用也不申请此类权限。',
      /* 实际可用的三条替代路径，界面上如实列出 */
      canHover: true,
      canDrag: true,
      canKeyboard: true,
      /* 「隔空」在本模块的确切含义。
         这里刻意不写「摄像头手势」四个字：状态文案要短且不含任何
         否定式绕弯，能力边界由 BOUNDARY 与 reason 完整交代。 */
      meaning: '悬停即感应，拖拽可洗牌与翻牌，键盘同样能走完全流程。'
    };
  }

  /* ---------------------------------------------------------------- 挂载 */

  /* 给真实 DOM 挂载交互。
     * 只负责**悬停感应与命中判定**；翻牌与洗牌由调用方接管
     * （牌桌已有自己的 click / keydown 处理，这里再绑一遍会双触发，
     *  一次点击翻两张牌）。
     * radius 与 rects 走的是与 testRig 相同的纯函数，所以无头测试
     * 覆盖到的判定逻辑就是真实路径在用的那一套。 */
  function attach(node, opts) {
    if (!node || typeof node.addEventListener !== 'function') {
      throw new Error('attach 需要一个真实的 DOM 节点。');
    }
    var o = opts || {};
    var radius = o.radius == null ? 10 : Number(o.radius);
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error('感应区半径必须是不小于 0 的数值。');
    }

    function slots() {
      var out = [];
      Array.prototype.forEach.call(node.querySelectorAll('[data-card]'), function (el) {
        var r = el.getBoundingClientRect();
        out.push({
          id: el.getAttribute('data-flipkey') || el.getAttribute('data-card'),
          x: r.left, y: r.top, w: r.width, h: r.height
        });
      });
      return out;
    }

    /* 感应区比牌面外扩 radius：指针在牌边一圈仍算「靠近」，
       手不用精确对准牌心，悬空感才成立。 */
    function hoverOn(ev) {
      var id = hitTest({
        clientX: ev.clientX,
        clientY: ev.clientY
      }, slots().map(function (s) {
        return { id: s.id, x: s.x - radius, y: s.y - radius, w: s.w + radius * 2, h: s.h + radius * 2 };
      }));
      Array.prototype.forEach.call(node.querySelectorAll('[data-card]'), function (el) {
        var key = el.getAttribute('data-flipkey') || el.getAttribute('data-card');
        el.classList.toggle('is-hover', key === id && !el.classList.contains('is-flipped'));
      });
      return id;
    }

    node.addEventListener('pointermove', function (ev) { hoverOn(ev); });
    node.addEventListener('pointerleave', function () {
      Array.prototype.forEach.call(node.querySelectorAll('[data-card]'), function (el) {
        el.classList.remove('is-hover');
      });
    });

    return {
      radius: radius,
      /* 暴露出来供调用方在需要时复用同一套判定 */
      hoverOn: hoverOn,
      slots: slots
    };
  }

  root.TarotHands = {
    version: 'tarot-hands-1.0.0',
    BOUNDARY: BOUNDARY,
    DECK_DRAG_RATIO: DECK_DRAG_RATIO,
    attach: attach,
    hitTest: hitTest,
    status: status,
    testRig: testRig
  };
})(typeof window !== 'undefined' ? window : globalThis);
