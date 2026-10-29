/* 复盘页 —— 把「首页测算 + 排盘 + 运势 + 日历 + 灾运」五路结果做总体分析。
 *
 * 设计原则：
 * 1. 表格交互式呈现，逐项列出「维度 / 现状（带证据）/ 判定 / 方案」。
 * 2. 判定为「好」的项目给锦上添花的加强方案；判定为「弱」的项目给具体解法。
 * 3. 每一项都必须有可核查的依据（命局结构、旺衰值、五行占比、当日干支），
 *    不输出与输入无关的通用话术。
 * 4. 只覆写 PAGES.profile，不改动占事版任何算法文件与既有页面。
 * 依赖占事版已有宿主符号：PAGES、PAGE_META、compute、dailyFortune、core、esc、emptyState、card 等。
 */
(function () {
  'use strict';

    if (typeof PAGES === 'undefined') return;

  /* ===== 动态视觉：复盘星盘（由 visual-fx.js 提供） ===== */
  let lastReviewRows = null;

  function mountReviewFX() {
    if (typeof VisualFX === 'undefined') return;
    const host = document.getElementById('fx-review-host');
    if (!host) return;
    const detailHost = document.getElementById('fx-review-detail-host');
    VisualFX.mount('fx-review', host, { rows: lastReviewRows || [], detailHost: detailHost });
    /* 【1.8.2】符箓馆：分类筛选与「符箓改命」按钮的绑定
     * （放在 mountReviewFX 里，是因为该函数本就是复盘页挂载后的统一入口）*/
    if (typeof window.bindFulu === 'function') window.bindFulu();
  }

  // 暴露给宿主的 render() 阶段调用
  window.mountReviewFX = mountReviewFX;

  /* ===== 样式（沿用软件现有暗金配色，与 .card/.yiji 体系一致） ===== */
  const st = document.createElement('style');
  st.textContent =
    '.rp-sum{display:flex;gap:10.0px;flex-wrap:wrap;margin:10.0px 0 4.0px}' +
    '.rp-chip{flex:1;min-width:88.0px;padding:10.0px 8.0px;border-radius:8.0px;background:#1c1c2b;text-align:center}' +
    '.rp-chip .n{font-size:19.0px;font-weight:600;line-height:1.3}' +
    '.rp-chip .t{font-size:11.0px;color:#8b8798;margin-top:3.0px}' +
    '.rp-chip.good .n{color:#7a9b8a}.rp-chip.mid .n{color:#d4a853}.rp-chip.bad .n{color:#e08878}' +
    '.rp-row{display:flex;align-items:stretch;border-bottom:1px solid #ffffff12}' +
    '.rp-row:last-child{border-bottom:none}' +
    '.rp-dim{flex:0 0 74.0px;padding:11.0px 6.0px;font-size:12.5px;color:#d4a853;text-align:center;display:flex;align-items:center;justify-content:center;letter-spacing:1.0px}' +
    '.rp-fact{flex:1 1 34%;padding:11.0px 8.0px;font-size:12.0px;color:#a8a29a;line-height:1.75;border-left:1px solid #ffffff0d;word-break:break-word}' +
    '.rp-verdict{flex:0 0 58.0px;padding:11.0px 4.0px;font-size:11.0px;text-align:center;display:flex;align-items:center;justify-content:center;border-left:1px solid #ffffff0d;letter-spacing:1.0px}' +
    '.rp-verdict.g{color:#7a9b8a}.rp-verdict.m{color:#d4a853}.rp-verdict.b{color:#e08878}' +
    '.rp-fix{flex:1 1 40%;padding:11.0px 8.0px;font-size:12.0px;line-height:1.75;border-left:1px solid #ffffff0d;color:#b8b4c4;word-break:break-word}' +
    '.rp-fix b{color:#d4a853;font-weight:500}' +
    '.rp-fix .lbl{color:#7a9b8a}.rp-fix .lbl.bad{color:#e08878}' +
    '.rp-head{display:flex;font-size:11.5px;color:#8b8798;padding:9.0px 6.0px;border-bottom:1px solid #d4a85344}' +
    '.rp-head .rp-dim,.rp-head .rp-verdict{color:#8b8798;letter-spacing:1.0px}' +
    '.rp-empty{padding:16.0px;text-align:center;color:#8b8798;font-size:12.5px;line-height:1.9}' +
    '.rp-tl{font-size:12.0px;color:#a8a29a;line-height:1.8;padding-left:18.0px;margin:6.0px 0}' +
    '.rp-ov{width:100%;border-collapse:collapse;font-size:12.5px;line-height:1.8}' +
    '.rp-ov td{padding:8.0px 6.0px;border-bottom:1px solid #ffffff0d;color:#a8a29a;vertical-align:top}' +
    '.rp-ov td:first-child{color:#d4a853;white-space:nowrap;width:96.0px}' +
    '@media(max-width:760px){.rp-fact,.rp-fix{flex-basis:100%}.rp-row{flex-wrap:wrap}}' +
    /* ===== 【1.8.2】符箓馆 =====
     * 用户要求「框放不下就加长」：符箓共 100 种，
     * 故用「加高的固定框 + 纵向滚动」，框体本身给足高度。*/
    '.fulu-card{margin-top:12px}' +
    '.fulu-intro{font-size:12.5px;line-height:1.9;color:#b8b2a4;margin-bottom:10px}' +
    '.fulu-intro b{color:#d4a853}' +
    '.fulu-disclaimer{font-size:11.5px;line-height:1.85;color:#8b8577;background:rgba(255,255,255,.03);border-left:2px solid rgba(212,168,83,.4);padding:8px 11px;border-radius:0 7px 7px 0;margin-bottom:12px}' +
    '.fulu-disclaimer b{color:#c9b884}' +
    '.fulu-cats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
    '.fulu-cat{display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:15px;cursor:pointer;background:rgba(255,255,255,.03);border:.5px solid rgba(212,168,83,.2);transition:all .18s}' +
    '.fulu-cat:hover{background:rgba(212,168,83,.12);border-color:rgba(212,168,83,.45)}' +
    '.fulu-cat.active{background:rgba(212,168,83,.2);border-color:rgba(212,168,83,.7)}' +
    '.fulu-cat .fc-ico{font-size:12px;color:#d4a853}' +
    '.fulu-cat .fc-name{font-size:12px;color:#cdc7b9}' +
    '.fulu-cat .fc-n{font-size:10px;color:#8b8577}' +
    '.fulu-cat.active .fc-name{color:#f0d696}' +
    '.fulu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:10px;height:560px;overflow-y:auto;padding:12px;background:linear-gradient(160deg,rgba(60,54,110,.18),rgba(20,22,48,.10));border:.5px solid rgba(212,168,83,.24);border-radius:10px}' +
    '.fulu-grid::-webkit-scrollbar{width:8px}' +
    '.fulu-grid::-webkit-scrollbar-track{background:rgba(255,255,255,.03);border-radius:4px}' +
    '.fulu-grid::-webkit-scrollbar-thumb{background:rgba(212,168,83,.3);border-radius:4px}' +
    '.fulu-item{background:rgba(255,255,255,.028);border:.5px solid rgba(212,168,83,.16);border-radius:9px;padding:11px 12px;transition:all .18s}' +
    '.fulu-item:hover{background:rgba(212,168,83,.09);border-color:rgba(212,168,83,.42);transform:translateY(-2px)}' +
    '.fi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}' +
    '.fi-cat{font-size:10px;color:#0f0f1a;background:rgba(212,168,83,.75);padding:1.5px 7px;border-radius:8px;letter-spacing:1px}' +
    '.fi-id{font-size:10px;color:#6b6b5f;letter-spacing:.5px}' +
    '.fi-name{font-size:13.5px;color:#e8d9a8;letter-spacing:.5px;margin-bottom:5px;font-weight:500}' +
    '.fi-desc{font-size:11.5px;line-height:1.75;color:#a8a29a;margin-bottom:5px}' +
    '.fi-use{font-size:11px;line-height:1.7;color:#8b8577;border-top:1px dashed rgba(212,168,83,.16);padding-top:5px}' +
    '.fulu-empty{text-align:center;color:#6b6b5f;font-size:12.5px;padding:40px 0;grid-column:1/-1}' +
    '.fulu-actions{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}' +
    '.fulu-gen-btn{flex:0 0 auto;min-width:172px;letter-spacing:4px}' +
    '.fulu-gen-note{font-size:11.5px;color:#8b8577;line-height:1.7;flex:1 1 240px;min-width:0}' +
    '.fulu-result{margin-top:14px}' +
    '.fulu-reason{background:rgba(60,54,110,.22);border:.5px solid rgba(212,168,83,.28);border-radius:9px;padding:12px 14px;margin-bottom:12px}' +
    '.fr-title{font-size:12px;color:#d4a853;letter-spacing:2px;margin-bottom:7px}' +
    '.fr-item{font-size:12px;line-height:1.85;color:#c0baac}' +
    '.fr-total{font-size:11.5px;color:#8b8577;margin-top:6px}' +
    '.fr-total b{color:#d4a853}' +
    '.fulu-picked{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:10px;margin-bottom:12px}' +
    '.fulu-picked .fulu-item{border-color:rgba(212,168,83,.5);background:rgba(212,168,83,.08)}' +
    '.fulu-tail{font-size:11.5px;line-height:1.85;color:#8b8577;border-top:1px dashed rgba(212,168,83,.2);padding-top:10px}' +
    '@media(max-width:700px){.fulu-grid{height:440px;grid-template-columns:1fr}.fulu-picked{grid-template-columns:1fr}}' +
    /* ===== 【1.8.3】符形：卡片两栏（左文右图） ===== */
    '.fulu-item{display:flex;gap:10px;align-items:stretch}' +
    '.fi-text{flex:1 1 auto;min-width:0}' +
    /* 符形画布：宣纸质感，鼠标可点 */
    '.fi-art{flex:0 0 auto;width:132px;position:relative;display:flex;flex-direction:column;align-items:center}' +
    '.fi-canvas{border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.45);cursor:zoom-in;background:#e8d08a}' +
    '.fi-zoom,.fs-tip{font-size:9.5px;color:#8b8577;letter-spacing:.5px;margin-top:3px;text-align:center}' +
    /* ===== 【1.8.3】符形：符箓改命长条框 ===== */
    '.fulu-scroll{margin-bottom:12px;display:flex;flex-direction:column;gap:11px}' +
    '.fs-row{display:flex;gap:14px;align-items:center;padding:12px 14px;border-radius:10px;background:linear-gradient(120deg,rgba(60,54,110,.20),rgba(20,22,48,.10));border:.5px solid rgba(212,168,83,.26)}' +
    '.fs-text{flex:1 1 auto;min-width:0}' +
    '.fs-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}' +
    '.fs-cat{font-size:10px;color:#0f0f1a;background:rgba(212,168,83,.8);padding:1.5px 7px;border-radius:8px;letter-spacing:1px}' +
    '.fs-id{font-size:10px;color:#6b6b5f;letter-spacing:.5px}' +
    '.fs-name{font-size:14px;color:#e8d9a8;letter-spacing:.5px;font-weight:500}' +
    '.fs-desc{font-size:11.5px;line-height:1.8;color:#a8a29a}' +
    '.fs-form{font-size:10.5px;line-height:1.7;color:#8b8577;margin-top:4px;border-top:1px dashed rgba(212,168,83,.16);padding-top:4px}' +
    /* 符形长条内的画布：加边框，成长条框 */
    '.fs-art{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;padding:8px 12px;border-radius:8px;background:rgba(232,208,138,.07);border:.5px solid rgba(212,168,83,.3)}' +
    '.fs-canvas{border-radius:4px;box-shadow:0 3px 14px rgba(0,0,0,.5);cursor:zoom-in;background:#e8d08a;display:block}' +
    /* ===== 【1.8.3】符形放大预览 ===== */
    '.fulu-zoom-mask{position:fixed;inset:0;background:radial-gradient(circle at 50% 35%,#182347,#050812 72%);z-index:999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}' +
    '.fulu-zoom-mask.hide{display:none}' +
    '.fz-panel{position:relative;width:100vw;height:100vh;padding:3vh 4vw;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,320px);gap:3vw;align-items:center;border:1px solid rgba(212,168,83,.4);text-align:left}' +
    '.fz-canvas{width:auto!important;height:min(94vh,calc(92vw * 1.333))!important;max-width:100%;aspect-ratio:3/4;border-radius:6px;box-shadow:0 8px 60px rgba(216,147,52,.25);background:#e8d08a;display:block;margin:0 auto;cursor:zoom-in}' +
    '.fz-canvas.fz-reference{height:min(76vh,76vw)!important;aspect-ratio:1/1}' +
    '.fz-name{font-size:16px;color:#f0d696;letter-spacing:1.5px;margin-top:12px}' +
    '.fz-form{font-size:11.5px;color:#a8a29a;margin-top:5px;letter-spacing:.5px}' +
    '.fz-desc{font-size:12px;line-height:1.8;color:#8b8577;margin-top:6px;max-width:400px}' +
    '.fz-close{position:absolute;right:20px;top:18px;font-size:16px;color:#e9d29f;cursor:pointer}' +
    '.fz-export{padding:10px 18px;border:1px solid #c89d51;border-radius:10px;color:#ffe6ad;background:#332819;cursor:pointer;margin-top:14px}' +
    '.fi-source{font-size:10px;color:#b9a677;margin:3px 0 5px}' +
    '@media(max-width:700px){.fz-panel{display:flex;flex-direction:column;overflow:auto}.fz-canvas{height:min(74vh,125vw)!important}.fz-meta{text-align:center}}' +
    '@media(max-width:700px){.fulu-item{flex-direction:column-reverse;align-items:center}.fi-art{width:auto}}';
  st.textContent += '.fulu-grid{grid-template-columns:repeat(auto-fill,minmax(255px,1fr))}.fulu-grid .fulu-item{flex-direction:column;gap:12px;align-items:stretch}.fulu-grid .fi-art{order:-1;align-self:center;width:auto}.fi-form{font-size:11px;color:#b6a789;line-height:1.8;padding-top:8px;border-top:1px dashed #b8a36144;overflow-wrap:anywhere}.fi-name{font-size:16px}.fi-desc,.fi-use{font-size:12px;color:#c9c4b6}.fulu-picked .fi-text{min-width:0}';
  document.head.appendChild(st);

  const E = typeof window.esc === 'function' ? window.esc : (s => String(s == null ? '' : s));

  /* ===== 工具：五行相生相克（与内核口径一致） ===== */
  const SH = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const WX_ORGAN = { 木: '肝胆与筋', 火: '心与小肠', 土: '脾胃与肌肉', 金: '肺与大肠', 水: '肾与膀胱' };
  const WX_METHOD = {
    木: '东方青色、多舒展。宜早起踏青、伸展筋骨，饮食可取酸味少许；忌久坐郁结。',
    火: '南方赤色、多明亮。宜午间小憩、保持心情畅达，忌熬夜耗神、忌过食辛辣。',
    土: '中央黄色、多厚重。宜规律三餐、细嚼慢咽，忌思虑过度伤脾、忌生冷不节。',
    金: '西方白色、多肃降。宜深呼吸、空气流通之处久居，饮食清淡，忌久处污浊。',
    水: '北方黑色、多藏养。宜早卧晚起、适度泡脚，忌劳神过思、忌熬夜。'
  };
  const SHICHEN_METHOD = {
    子: '子时（23-01点）胆经当令，宜早睡养胆，不宜熬夜。',
    丑: '丑时（01-03点）肝经当令，宜深睡养肝，忌饮酒熬夜。',
    寅: '寅时（03-05点）肺经当令，宜熟睡养肺，忌受寒。',
    卯: '卯时（05-07点）大肠经当令，宜起身排便、饮温水。',
    辰: '辰时（07-09点）胃经当令，宜按时早餐、忌冷食。。',
    巳: '巳时（09-11点）脾经当令，宜处理思虑工作、忌久坐。。',
    午: '午时（11-13点）心经当令，宜小憩养心，忌剧烈运动。。',
    未: '未时（13-15点）小肠经当令，宜多补水、忌过食。',
    申: '申时（15-17点）膀胱经当令，宜活动筋骨、多饮水。',
    酉: '酉时（17-19点）肾经当令，宜适度运动、忌过度劳累。',
    戌: '戌时（19-21点）心包经当令，宜舒缓情绪、忌剧烈争执。',
    亥: '亥时（21-23点）三焦经当令，宜静心收敛、准备入睡'
  };

  /* 判定分档：>=65 好，>=50 平，<50 需改善 */
  const v3 = s => (s >= 65 ? 'g' : (s >= 50 ? 'm' : 'b'));
  const vTxt = (g, good) => (g === 'g' ? '好' : (g === 'm' ? '平' : '待改善'));

  /* ===== 主复盘函数 =====
   * 输入：compute() 的结果 + 今日运势
   * 输出：五路结果交叉分析后的表格 */
  function buildReview(bazi, birth, f) {
    const me = bazi.dayWuXing;
    const dayMaster = bazi.dayGan;
    const xi = bazi.yongshen.xi || [];
    const ji = bazi.yongshen.ji || [];
    const v = bazi.strength ? bazi.strength.value : 0;
    const meStat = bazi.wuxingStat.score.find(s => s.wuXing === me) || { percent: 0 };
    const mePct = parseFloat(meStat.percent) || 0;

    /* 找出命局最弱一环（占比最低且有值的五行） */
    let weakest = null, strongest = null;
    bazi.wuxingStat.score.forEach(s => {
      const p = parseFloat(s.percent) || 0;
      if (p > 0 && (!weakest || p < parseFloat(weakest.percent))) weakest = s;
      if (p > 0 && (!strongest || p > parseFloat(strongest.percent))) strongest = s;
    });
    const missing = bazi.wuxingStat.missing || [];

    const rows = [];

    /* ---- 1. 日主强弱（排盘） ---- */
    {
      const strongTxt2 = v >= 3 ? `偏强（旺衰值 ${v}），本气充足` : (v <= -3 ? `偏弱（旺衰值 ${v}），根气不足` : `中和（旺衰值 ${v}），强弱得宜`);
      const g = v >= 3 ? 'g' : (v <= -3 ? 'b' : 'm');
      let fix;
      if (v >= 3) {
        fix = `日主偏强，宜适度消耗而非一味补益。<b>宜</b>：多运动汗出、动手做事以泄其气；<b>忌</b>：久坐不动、过度进补。<span class="lbl">锦上添花</span>：${WX_METHOD[xi[0] || me] || ''}`;
      } else if (v <= -3) {
        fix = `日主偏弱，首重扶助与减耗。<b>宜</b>：规律作息以养元气、量力而行使气得舒展；<b>忌</b>：过劳透支、久病拖延。<span class="lbl bad">解法</span>：${WX_METHOD[xi[0] || SH[me]] || ''}`;
      } else {
        fix = `中和之局，无需大补大泄，重在守中。<b>宜</b>：按节律作息、遇事留三分余地；<span class="lbl">锦上添花</span>：${WX_METHOD[xi[0] || me] || ''}`;
      }
      rows.push({
        dim: '日主',
        fact: `${dayMaster}${me}命。${strongTxt2}。同类${me}占命局 ${meStat.percent}，${mePct >= 40 ? '偏旺易分财' : (mePct > 0 && mePct <= 12 ? '偏少助力薄' : '厚薄适中')}。喜用${xi.join('、') || '—'}，忌${ji.join('、') || '—'}。`,
        g, fix
      });
    }

    /* ---- 2. 五行分布（排盘） ---- */
    {
      const missingTxt = missing.length ? `命局缺${missing.join('、')}` : '五行俱全无缺';
      let g = 'm';
      if (missing.length >= 2) g = 'b';
      else if (missing.length === 0 && strongest && parseFloat(strongest.percent) >= 40) g = 'm';
      else if (!missing.length) g = 'g';
      let fix;
      if (missing.length >= 2) {
        const need = missing[0];
        fix = `缺${missing.length}种五行，根基不全是主要短板。<b>解法</b>：<span class="lbl bad">补${need}</span> — ${WX_METHOD[need] || ''}`;
      } else if (missing.length === 1) {
        fix = `独缺${missing[0]}。<b>解法</b>：<span class="lbl">补${missing[0]}</span> — ${WX_METHOD[missing[0]] || ''}`;
      } else {
        fix = `五行俱全。<span class="lbl">锦上添花</span>：${strongest ? `命局${strongest.wuXing}最旺（${strongest.percent}），可留意${WX_ORGAN[strongest.wuXing] || ''}是否过度` : '均衡为上，宜顺势而为'}。${WX_METHOD[xi[0] || me] || ''}`;
      }
      rows.push({
        dim: '五行',
        fact: `${bazi.wuxingStat.score.map(s => `${s.wuXing}${s.percent}`).join('　')}。${missingTxt}。${strongest ? `最旺为${strongest.wuXing}（${strongest.percent}）。` : ''}`,
        g, fix
      });
    }

    /* ---- 3. 今日运势（运势页） ---- */
    if (f && f.scores) {
      const s = f.scores;
      const avg = Math.round((s.wealth + s.love + s.career + s.health) / 4);
      const g = v3(avg);
      const dimTxt = [
        `财运 ${s.wealth}`,
        `感情 ${s.love}`,
        `事业 ${s.career}`,
        `健康 ${s.health}`
      ].join('　');
      const weakDim = Object.keys(s).reduce((a, k) => (s[k] < s[a] ? k : a), 'wealth');
      const WN = { wealth: '财运', love: '感情', career: '事业', health: '健康' };
      let fix;
      if (g === 'g') {
        fix = `今日四维${dimTxt}，均值 ${avg} 分，整体顺畅。<span class="lbl">锦上添花</span>：趁势推进重要之事；今日日支${f.dayZhi}与命局关系：${f.chongList.length ? `冲${f.chongList.map(r => r.zhi).join('、')}` : (f.heList.length ? `合${f.heList.map(r => r.zhi).join('、')}` : '无明显刑冲')}。`;
      } else if (g === 'm') {
        fix = `今日四维${dimTxt}，均值 ${avg} 分，中平略有起伏。<b>宜</b>：按既定节奏推进；<b>忌</b>：临时变更大方向。其中「${WN[weakDim]}」相对最弱（${s[weakDim]} 分），${WN[weakDim]}之事宜更谨慎。`;
      } else {
        fix = `今日四维${dimTxt}，均值 ${avg} 分，整体偏弱。<span class="lbl bad">解法</span>：宜守不宜攻，把${WN[weakDim]}（${s[weakDim]} 分）相关之事暂缓；${f.danger === '高' ? '危险指数偏高，今日宜静、忌外出与高风险活动。' : (f.danger === '中' ? '危险指数中等，遇事宜冷静，忌冲动决策。' : '危险指数尚可，忌过度劳累。')}`;
      }
      rows.push({
        dim: '今日运势',
        fact: `${f.dateText} ${f.dayGanZhi}，十神「${f.shishen}」，${f.wangShuai.level}。四维：${dimTxt}。均值 ${avg} 分，危险指数${f.danger}（${f.dangerScore}）。`,
        g, fix
      });

      /* ---- 4. 今日灾运（灾运页） ---- */
      {
        const dg = f.danger === '高' ? 'b' : (f.danger === '中' ? 'm' : 'g');
        const rel = [];
        if (f.chongList.length) rel.push(`冲${f.chongList.map(r => r.pillar + r.zhi).join('、')}`);
        if (f.xingList.length) rel.push(`刑${f.xingList.map(r => r.zhi).join('、')}`);
        if (f.haiList.length) rel.push(`害${f.haiList.map(r => r.zhi).join('、')}`);
        if (f.heList.length) rel.push(`合${f.heList.map(r => r.zhi).join('、')}`);
        let fix;
        if (dg === 'g') {
          fix = `日支与命局${rel.length ? rel.join('；') : '无刑冲合害'}，格局平稳。<span class="lbl">锦上添花</span>：保持规律作息即可，无需额外忌讳。`;
        } else if (dg === 'm') {
          fix = `日支与命局${rel.length ? rel.join('；') : '略有牵动'}，波动中等。<b>宜</b>：遇事宜留余地、忌冲动决策；${f.dangerScore >= 22 ? '减少不必要的外出与冒险。' : '按常规节奏即可。'}`;
        } else {
          fix = `日支与命局${rel.length ? rel.join('；') : '冲刑较重'}，危险指数${f.dangerScore}偏高。<span class="lbl bad">解法</span>：今日宜静不宜动，尽量避免外出与高风险活动，注意交通安全；重要决定三思而后行。`;
        }
        rows.push({
          dim: '今日灾忌',
          fact: `冲${f.chongShengXiao || '无'}。${rel.length ? '与命局存在' + rel.join('、') + '之象。' : '与命局无明显刑冲合害。'}${f.shishen === '七杀' && v <= -3 ? '七杀当值而身弱，压力叠加。' : ''}`,
          g: dg, fix
        });
      }
    }

    /* ---- 5. 时辰与作息（日历页维度） ---- */
    {
      const shichen = (bazi.birth && bazi.birth.hourText) || '时辰未知';
      const zhi = bazi.pillars[3] ? bazi.pillars[3].zhi : '';
      const g = (v <= -3 || v >= 3) ? 'm' : 'g';
      const good = v >= 0;
      let fix;
      if (good) {
        fix = `生于${shichen}，时支${zhi}属${ZHI_WX_LOCAL(zhi)}。<span class="lbl">锦上添花</span>：${SHICHEN_METHOD[zhi] || '按此经络当令时段作息最佳。'}`;
      } else {
        fix = `生于${shichen}，时支${zhi}属${ZHI_WX_LOCAL(zhi)}。日主偏弱，作息尤为关键。<span class="lbl bad">解法</span>：${(SHICHEN_METHOD[zhi] || '').replace(/。$/, '')}，另宜节饮食、慎耗神。`;      }
      rows.push({
        dim: '注意事项',
        fact: `${shichen}（${bazi.birth && bazi.birth.hourKnown ? '时辰已知' : '时辰未指定，已按默认推算'}）。时柱${bazi.pillars[3] ? bazi.pillars[3].gan + zhi : '—'}，胎元${bazi.taiyuan ? bazi.taiyuan.gan + bazi.taiyuan.zhi : '—'}，命宫在${bazi.minggong ? bazi.minggong.zhi : '—'}。`,
        g, fix
      });
    }

    /* ---- 6. 大运（排盘页维度） ---- */
    if (bazi.yun && bazi.yun.items && bazi.yun.items.length) {
      const cur = bazi.yun.items.find(d => d.current) || bazi.yun.items[0] || bazi.yun.items[1];
      if (cur) {
        const yunWx = cur.gan ? GAN_WX_LOCAL(cur.gan) + ZHI_WX_LOCAL(cur.zhi) : '';
        const yunIsXi = yunWx && xi.some(k => yunWx.indexOf(k) >= 0);
        const yunIsJi = yunWx && ji.filter(k => yunWx.indexOf(k) >= 0).length > (yunIsXi ? 0 : 0);
        const g = yunIsXi ? 'g' : (yunIsJi ? 'm' : 'm');
        let fix;
        if (yunIsXi) {
          fix = `现行大运${cur.gan}${cur.zhi}（${yunWx}）为你喜用，十年大环境助力。<span class="lbl">锦上添花</span>：此运宜主动进取、把握机遇，${WX_METHOD[yunWx[0]] || ''}`;
        } else {
          fix = `现行大运${cur.gan}${cur.zhi}（${yunWx}）于命局非喜用，十年大环境偏中性或略有牵制。<b>宜</b>：守成积累、以内功取胜；<span class="lbl">解法</span>：借喜用${xi[0] || ''}之气补运 — ${WX_METHOD[xi[0] || me] || ''}`;
        }
        rows.push({
          dim: '大运',
          fact: `起运${bazi.yun.startAge ? bazi.yun.startAge + '岁' : '—'}，现行大运${cur.gan}${cur.zhi}（${cur.startAge || '—'}~${cur.endAge || '—'}岁）。该运五行${yunWx || '—'}，于命局${yunIsXi ? '属喜用，为助' : (yunIsJi ? '带忌，为压' : '中性')}。`,
          g, fix
        });
      }
    }

    return rows;
  }

  /* 本地地支五行（避免依赖内核私有常量） */
  function ZHI_WX_LOCAL(z) {
    return { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }[z] || '';
  }
  function GAN_WX_LOCAL(g) {
    return { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }[g] || '';
  }

  /* ===== 页面注册：覆写 profile ===== */
  PAGES.profile = function () {
    const r = (typeof compute === 'function') ? compute() : null;
    const gua = (window.core && core.getDailyGua) ? core.getDailyGua(new Date()) : null;

    if (!r) {
      return `
      <div class="card">
        <div class="card-title"><span>关于本程序</span><span class="card-title-line"></span></div>
        <div class="disclaimer">
          本程序基于《周易》《三命通会》《渊海子平》《滴天髓》等传统典籍编制，仅供传统文化研究与娱乐参考，不构成任何决策建议。<br><br>
          生辰信息仅保存在本机浏览器，不上传服务器。
        </div>
      </div>
      ${typeof emptyState === 'function' ? emptyState('尚未录入生辰', '前往首页录入后可查看复盘') : ''}`;
    }

    const bazi = r.bazi, birth = r.birth;
    const f = (typeof dailyFortune === 'function') ? dailyFortune(bazi, new Date()) : null;
    const rows = buildReview(bazi, birth, f);

    /* ============================================================
     * 【1.8.2 新增】符箓馆
     *
     * 用户反馈：「总体复盘右边点一下就能看到日主、五行的结果，
     * 与下方分项复盘与方案一模一样，所以那个框没有必要」——
     * 这是准确的观察：分项表的前两列已在右侧详情里呈现，确属重复。
     * 故将「分项复盘与方案」整框替换为「符箓馆」。
     *
     * 事实来源：完全取自 bazi 的既有输出（wuxingStat / yongshen / minggong）
     * 与复盘判定（rows 里有无「待改善」项），
     * 经 fulu-library.js 匹配出**与本盘实际不利方向相关**的符箓。
     * ============================================================ */
    const FL = (typeof root !== 'undefined' && root.FuluLibrary) ? root.FuluLibrary
      : (typeof FuluLibrary !== 'undefined' ? FuluLibrary : null);
    const fuluFacts = {
      dayWuXing: bazi.dayWuXing,
      wuxingStat: bazi.wuxingStat,
      yongshen: bazi.yongshen,
      minggong: bazi.minggong,
      hasBad: rows.some((x) => x.g === 'b'),
      birth: (bazi.pillars || []).map((p) => p.gan + p.zhi).join('')
    };
    const fuluCats = FL ? FL.CATS : [];
    const fuluLib = FL ? FL.LIB : [];
    /* 供 bindFulu() 使用（本函数外无法直接访问局部变量） */
    window.__fuluFacts = fuluFacts;
    // 供 render() 阶段的 mountVisualFX() 挂载复盘星盘使用
    lastReviewRows = rows;

    /* 顶部总评：统计好/平/待改善 */
    const cnt = { g: 0, m: 0, b: 0 };
    rows.forEach(x => cnt[x.g]++);
    const overall = cnt.g > cnt.b + cnt.m ? 'g' : (cnt.b > cnt.g + cnt.m ? 'b' : 'm');
    const overallTxt = overall === 'g'
      ? '命局与运势整体良好，宜顺势而为'
      : (overall === 'b' ? '命局与运势整体偏弱，宜守中补短'
        : '命局与运势强弱参半，宜取长补短');
    const overallScore = rows.length
      ? Math.round(rows.reduce((a, x) => a + (x.g === 'g' ? 78 : (x.g === 'm' ? 58 : 40)), 0) / rows.length)
      : 50;

    return `
    <div class="card has-fx">
      <div class="card-title"><span>总体复盘</span><span class="card-title-line"></span></div>
      <div class="fx-review-flex">
      <div class="fx-col" style="flex:1 1 auto;min-width:0">
        <div style="font-size:13.0px;color:#a8a29a;line-height:1.9">
          综合首页测算、排盘、运势、日历与灾运五项，${E(birth.name || '本人')}
          （${E(bazi.birth.year)}年${bazi.birth.month}月${bazi.birth.day}日${E(bazi.birth.hourText)}）今日总评：<b style="color:${overall === 'g' ? '#7a9b8a' : (overall === 'b' ? '#e08878' : '#d4a853')}">${E(overallTxt)}</b>（综合分 ${overallScore}）。
        </div>
        <div class="rp-sum">
          <div class="rp-chip good"><div class="n">${cnt.g}</div><div class="t">好 · 锦上添花</div></div>
          <div class="rp-chip mid"><div class="n">${cnt.m}</div><div class="t">平 · 顺势而为</div></div>
          <div class="rp-chip bad"><div class="n">${cnt.b}</div><div class="t">待改善 · 需解法</div></div>
        </div>
      </div>
      <div class="fx-review-holder fx-holder" id="fx-review-host"></div>
      </div>
      <div class="fx-review-side" id="fx-review-detail-host" style="margin-top:12px"></div>
      <div class="fx-hint">星盘五轴对应下方分项复盘的五个维度：绿为「好·锦上添花」、金为「平·顺势而为」、赤为「待改善·需解法」。点击任一顶点或标签，可在上方查看该项的测算现状与方案。</div>
    </div>

    <!-- 【1.8.2】分项复盘与方案 → 符箓馆
         原因：分项表的前两列与上方「总体复盘」右侧详情重复（用户反馈属实），
         故整框替换为符箓馆；分项内容仍可从上方星盘点击各顶点查看。 -->
    <div class="card wide-card fulu-card">
      <div class="card-title"><span>符箓馆</span><span class="card-title-line"></span></div>
      <div class="fulu-intro">
        收录原创文化符图与用户提供的参考图共 <b>${fuluLib.length}</b> 种，分${fuluCats.length}类。
        馆内全部图像可按主题浏览；下方组合则按本盘现有规则筛选相关的文化主题。
      </div>
      <div class="fulu-disclaimer">
        <b>文化说明</b>：符箓为道教符文化与民间傩文化的历史遗存，此处仅作
        <b>传统文化研究性展示</b>。图形尚未经逐项图录核证，不作为宗教仪轨。「符箓改命」所出为<b>文化性参考建议</b>，
        作用机制是提示与行为引导，<b>不承诺、也不宣称能够改变客观命运</b>。
      </div>

      <div class="fulu-cats">
        ${fuluCats.map(c => `<div class="fulu-cat" data-cat="${c.key}">
          <div class="fc-ico">${c.icon}</div>
          <div class="fc-name">${c.label}</div>
          <div class="fc-n">${fuluLib.filter(f => f.cat === c.key).length}</div>
        </div>`).join('')}
      </div>

      <div class="fulu-grid" id="fulu-grid"></div>

      <div class="fulu-actions">
        <button class="btn-primary fulu-gen-btn" id="btn-fulu-gen">符 箓 改 命</button>
        <div class="fulu-gen-note" id="fulu-gen-note">
          点击后将依据本盘忌神与待改善项，生成可参考的符箓组合（含生成依据）
        </div>
      </div>
      <div class="fulu-result" id="fulu-result"></div>
    </div>

    ${gua ? `
    <div class="card">
      <div class="card-title"><span>今日一卦（参）</span><span class="card-title-line"></span></div>
      <div class="gua-box">
        <div class="gua-symbol">${E(gua.symbol)}</div>
        <div style="font-size:15.0px;color:#d4a853;letter-spacing:2.0px">${E(gua.gua)}</div>
        <div class="gua-text">${E(gua.text)}</div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span>关于本程序</span><span class="card-title-line"></span></div>
      <div class="disclaimer">
        复盘结论由本机依据录入生辰推算，仅供传统文化研究与娱乐参考，不构成任何决策建议。<br><br>
        生辰信息仅保存在本机浏览器，不上传服务器。历法计算由 lunar-javascript 库提供。
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>数据管理</span><span class="card-title-line"></span></div>
      <button class="btn-ghost" id="btn-clear" style="margin-top:0">清除生辰数据</button>
    </div>`;
  };

  /* ============================================================
   * 【1.8.2】符箓馆交互：分类筛选 + 符箓改命生成
   *
   * 生成逻辑全部在 fulu-library.js 内（依据命盘实际不利项匹配），
   * 此处只负责：渲染卡片、绑定事件、显示生成依据。
   * ============================================================ */
  /* 【1.8.3】符箓卡片：左文右图
   * 用户要求「把符箓的图案放在每个符箓注释的右边」。
   * 故卡片改为两栏：左侧文字（分类/编号/名称/说明/用法），
   * 右侧符箓图案（由 fulu-art.js 按传统「符头+符胆+符脚」形制绘制）。
   * 图案的符胆取自该符名本身，故给出什么符就画什么符的形制。*/
  function fuluCardHtml(f) {
    const cat = E(f.cat);
    const design = window.FuluDesign && window.FuluDesign.designOf(f.id);
    const prov = design && design.prov || {};
    const source = f.image ? '用户提供原图 · 2048×2048' : (prov.level === 'literature' ? '名称有传统记载，图形原创' : '原创文化符图，非传承符式');
    return `<div class="fulu-item" data-cat="${f.cat}" data-id="${f.id}">
      <div class="fi-text">
        <div class="fi-top">
          <span class="fi-cat">${cat}</span>
          <span class="fi-id">${f.id}</span>
        </div>
        <div class="fi-name">${E(f.name)}</div>
        <div class="fi-source" title="${E(prov.note||'尚无可核对的馆藏图录')}">${E(source)}</div>
        <div class="fi-desc">${E(f.desc)}</div>
        <div class="fi-use">用法：${E(f.use.replace(/^用法[：:]\s*/,''))}</div>
        ${f.form?`<div class="fi-form">符头 ${E(f.form.head)} · 符胆 ${E(f.form.dan)} · 符脚 ${E(f.form.foot)} · 奉神 ${E(f.form.deity)}</div>`:''}
      </div>
      <div class="fi-art" title="点击放大查看符形">
        <canvas class="fi-canvas" data-fulu="${f.id}" width="132" height="176"></canvas>
        <div class="fi-zoom">点击符形可放大</div>
      </div>
    </div>`;
  }

  /* 绘制所有可见符箓的图案（分类筛选后需重绘） */
  function paintFuluArts(scope) {
    if (!window.FuluArt) return;
    const boxes = (scope || document).querySelectorAll('.fi-canvas');
    if (!boxes.length) return;
    const lib = window.FuluLibrary ? window.FuluLibrary.LIB : [];
    boxes.forEach((cv) => {
      const f = lib.find((x) => x.id === cv.getAttribute('data-fulu'));
      if (!f) return;
      /* 高清：按2x 像素比绘制 CSS 尺寸132x176 */
      cv.style.width = '132px';
      cv.style.height = '176px';
      window.FuluArt.draw(cv, f, { grow: 1 });
    });
  }

  /* 放大预览：符箓改命与馆内共用 */
  function openFuluZoom(f) {
    let box = document.getElementById('fulu-zoom');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fulu-zoom';
      box.className = 'fulu-zoom-mask hide';
      box.innerHTML = '<div class="fz-panel">'
        + '<canvas class="fz-canvas" width="600" height="800"></canvas>'
        + '<div class="fz-meta"><div class="fz-name"></div>'
        + '<div class="fz-form"></div>'
        + '<div class="fz-desc"></div>'
        + '<button class="fz-export" type="button">导出高清 PNG</button></div>'
        + '<button class="fz-close" type="button">关闭 ×</button>'
        + '</div>';
      document.body.appendChild(box);
      box.addEventListener('click', (ev) => {
        if (ev.target === box || ev.target.closest('.fz-close')) {
          if (box.__anim) box.__anim.stop();
          box.classList.add('hide');
        }
      });
    }
    const R = window.FuluArt ? window.FuluArt.resolve(f) : null;
    const cv = box.querySelector('.fz-canvas');
    if (box.__anim) box.__anim.stop();
    cv.classList.toggle('fz-reference',!!f.image);
    box.querySelector('.fz-name').textContent = f.name;
    box.querySelector('.fz-form').textContent = f.form ? ('符头：' + f.form.head + ' · 符胆：' + f.form.dan + ' · 符脚：' + f.form.foot + ' · 奉神：' + f.form.deity) : R
      ? ('符头：' + R.form.head + ' · 符胆：' + R.dan + ' · 符脚：' + R.foot + ' · 奉神：' + R.deity)
      : '';
    box.querySelector('.fz-desc').textContent = f.desc + '　用法：' + f.use;
    box.querySelector('.fz-export').textContent=f.image?'保存原图 2048×2048 PNG':'导出高清 PNG';
    box.querySelector('.fz-export').onclick = () => {
      if(f.image){const a=document.createElement('a');a.download=(f.id||'符图')+'-'+f.name+'-2048x2048.png';a.href=f.image;a.click();return;}
      if (!window.FuluArt) return;
      window.FuluArt.draw(cv, f, { grow: 1, pixelWidth: 2880 });
      const a = document.createElement('a');
      a.download = (f.id || '符图') + '-' + f.name + '-2880x3840.png';
      a.href = cv.toDataURL('image/png'); a.click();
    };
    box.classList.remove('hide');
    if (window.FuluArt) box.__anim = window.FuluArt.animate(cv, f, {
      dur: 4200,
      onDone: () => window.FuluArt.draw(cv, f, { grow: 1, pixelWidth: 2880 })
    });
  }

  window.openFuluZoom = openFuluZoom;
  /* 供筛选使用 */
  function renderFulu(cat) {
    const grid = document.getElementById('fulu-grid');
    if (!grid || !window.FuluLibrary) return;
    const list = (cat === 'all')
      ? window.FuluLibrary.LIB
      : window.FuluLibrary.LIB.filter((f) => f.cat === cat);
    grid.innerHTML = list.length
      ? list.map(fuluCardHtml).join('')
      : '<div class="fulu-empty">该分类下暂无符箓</div>';
    grid.setAttribute('data-count', String(list.length));
    /* 【1.8.3】新节点插入后再绘制图案 */
    paintFuluArts(grid);
  }

  /* 生成依据的文字说明（把「为什么是这几张」讲清楚） */
  function fuluReasonHtml(facts, matched) {
    const ys = facts.yongshen || { xi: [], ji: [] };
    const stat = (facts.wuxingStat && facts.wuxingStat.score) || [];
    const over = stat.filter((s) => parseFloat(s.percent) >= 30).map((s) => s.wuXing + ' ' + s.percent);
    const under = stat.filter((s) => parseFloat(s.percent) <= 12).map((s) => s.wuXing + ' ' + s.percent);
    const lines = [];
    if (ys.ji && ys.ji.length) lines.push('忌神五行：' + ys.ji.join('、'));
    if (ys.xi && ys.xi.length) lines.push('喜用五行：' + ys.xi.join('、'));
    if (over.length) lines.push('偏旺需泄：' + over.join('、'));
    if (under.length) lines.push('偏枯需扶：' + under.join('、'));
    if (facts.hasBad) lines.push('复盘存在「待改善」项');
    if (facts.minggong) lines.push('命宫五行：' + facts.minggong.wuXing);
    return `<div class="fulu-reason">
      <div class="fr-title">生成依据（取自本盘实际推算）</div>
      <div class="fr-list">${lines.map((l) => '<div class="fr-item">· ' + E(l) + '</div>').join('')}</div>
      <div class="fr-total">本盘共匹配到 <b>${matched.total}</b> 种相关符箓，下列为其中最贴合者 ${matched.items.length} 种。</div>
    </div>`;
  }

  /* 绑定：在 DOM 就绪后由 render() 之后的统一阶段调用 */
  function bindFulu() {
    const grid = document.getElementById('fulu-grid');
    if (!grid) return;
    /* 【1.8.2 · 修复】facts 一律从 window.__fuluFacts 取。
     * 原先 mountReviewFX 调用 bindFulu() 时不传参，
     * 而函数内又用形参 facts 覆盖了全局值，
     * 导致点击「符箓改命」时 facts 为 undefined → 读 dayWuXing 抛错、生成 0 条。*/
    const facts = window.__fuluFacts;
    if (!facts || !facts.wuxingStat) return;

    /* 初始：展示全部（数量可能多，容器已是可滚动的长方框） */
    renderFulu('all');

    /* 分类筛选 */
    document.querySelectorAll('.fulu-cat').forEach((c) => {
      c.onclick = () => {
        document.querySelectorAll('.fulu-cat').forEach((x) => x.classList.remove('active'));
        c.classList.add('active');
        renderFulu(c.dataset.cat);
      };
    });
    if (document.querySelector('.fulu-cat')) {
      document.querySelector('.fulu-cat').classList.add('active');
    }

    /* 【1.8.3】点击符形放大（事件委托，覆盖馆内卡片与改命长条两种版式）*/
    document.addEventListener('click', function (ev) {
      const cv = ev.target && ev.target.classList
        && (ev.target.classList.contains('fi-canvas') || ev.target.classList.contains('fs-canvas'))
        ? ev.target : null;
      if (!cv || !window.FuluLibrary || !window.openFuluZoom) return;
      const f = window.FuluLibrary.LIB.find((x) => x.id === cv.getAttribute('data-fulu'));
      if (f) window.openFuluZoom(f);
    });

    /* 符箓改命 */
    const btn = document.getElementById('btn-fulu-gen');
    const out = document.getElementById('fulu-result');
    if (btn) {
      btn.onclick = () => {
        if (!window.FuluLibrary) return;
        const matched = window.FuluLibrary.matchFulu(facts, 6);
        if (!matched.items.length) {
          out.innerHTML = '<div class="fulu-empty">本盘五行平和、无显著忌神，暂无需要化解的方向。</div>';
          return;
        }
        /* 【1.8.3】生成长条版：上方文字注释（分类/名/说明/用法），
         * 下方一条横贯的符形长条框，符形以动画生长方式画出，
         * 点击可放大。逐条生长以形成「依次显符」的仪式感。 */
        out.innerHTML = fuluReasonHtml(facts, matched) +
          '<div class="fulu-scroll">' + matched.items.map(function (f) {
        const R = !f.image && window.FuluArt ? window.FuluArt.resolve(f) : null;
        return '<div class="fs-row" data-fid="' + f.id + '">'
            + '<div class="fs-text">'
            + '<div class="fs-head"><span class="fs-cat">' + E(f.cat) + '</span>'
            + '<span class="fs-id">' + f.id + '</span>'
            + '<span class="fs-name">' + E(f.name) + '</span></div>'
            + '<div class="fs-desc">' + E(f.desc) + '　用法：' + E(f.use) + '</div>'
            + (f.form ? '<div class="fs-form">符头 ' + E(f.form.head)
              + ' · 符胆 ' + E(f.form.dan)
              + ' · 符脚 ' + E(f.form.foot)
              + ' · 奉 ' + E(f.form.deity) + '</div>' : R ? '<div class="fs-form">符头 ' + E(R.form.head)
              + ' · 符胆 ' + E(R.dan)
              + ' · 符脚 ' + E(R.foot)
              + ' · 奉 ' + E(R.deity) + '</div>' : '')
            + '</div>'
            + '<div class="fs-art"><canvas class="fs-canvas" data-fulu="' + f.id + '"></canvas>'
            + '<div class="fs-tip">点击符形放大</div></div>'
            + '</div>';
      }).join('') + '</div>' +
          '<div class="fulu-tail">以上符箓依本盘忌神与待改善项推得，' +
          '作为文化参考与日常提醒之用；命理结论仍以本页上方复盘为准，' +
          '实际行事仍以理性判断与现实条件为依。</div>';
        out.setAttribute('data-picked', String(matched.items.length));
        /* 逐条动画生长：每条延迟 260ms，观感如「依次显符」 */
        if (window.FuluArt) {
          const lib = window.FuluLibrary ? window.FuluLibrary.LIB : [];
          const rows = out.querySelectorAll('.fs-row');
          rows.forEach((row, i) => {
            const cv = row.querySelector('.fs-canvas');
            const f = lib.find((x) => x.id === row.getAttribute('data-fid'));
            if (!cv || !f) return;
            cv.style.width = '150px';
            cv.style.height = '200px';
            setTimeout(() => {
              window.FuluArt.animate(cv, f, { dur: 1200 });
            }, i * 260);
          });
        }
      };
    }
  }

  window.bindFulu = bindFulu;

  /* 页面标题与副标题 */
  PAGE_META.profile = ['复盘', '五项结果总体分析 + 符箓馆（按本盘不利项匹配）'];

  /* 侧栏改名：「我」→「复盘」 */
  const navItem = document.querySelector('.nav-item[data-page="profile"]');
  if (navItem) {
    const ico = navItem.querySelector('.nav-ico');
    const label = navItem.querySelector('span:not(.nav-ico)');
    if (ico) ico.textContent = '盘';
    if (label) label.textContent = '复盘';
  }
})();
