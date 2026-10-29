/* 起名工坊 · 人名 / 公司名 / 品牌名
 *
 * 硬性原则：
 *  - 三类名字分开处理，不混成同一套"吉凶打分"。
 *  - 禁用字、字数、姓氏、风格等条件实际生效，不是摆设。
 *  - 出处必须真实可核对；查不到可靠出处的写"原创组合"，不编诗句与古籍引文。
 *  - 多音字必须让用户确认读音后才写入候选。
 *  - 商标与工商重名未接入可靠查询，一律显示"尚未核验"，不保证可注册。
 *  - 笔画与五格如提供，单列为文化选项，不主导实用推荐。
 */
(function (global) {
  'use strict';

  var Reg = global.ExtModuleRegistry;

  /* ------------------------------------------------------------ 字库 */

  /* 每个字含：字义、常见度（1 罕见 - 5 极常见）、意象标签、多音字信息。 */
  var CHARS = [
    { c: '安', meaning: '安定、平息', common: 4, imagery: ['安定', '从容'], pinyin: [['ān', 1]] },
    { c: '柏', meaning: '柏树，长青', common: 3, imagery: ['长青', '坚韧'], pinyin: [['bǎi', 1], ['bó', 2], ['bò', 3]] },
    { c: '白', meaning: '清白、明亮', common: 5, imagery: ['清朗', '纯粹'], pinyin: [['bái', 1]] },
    { c: '半', meaning: '一半、未全', common: 4, imagery: ['分寸'], pinyin: [['bàn', 1]] },
    { c: '川', meaning: '河流', common: 3, imagery: ['流动', '开阔'], pinyin: [['chuān', 1]] },
    { c: '澄', meaning: '清澈', common: 2, imagery: ['清澄', '明澈'], pinyin: [['chéng', 1], ['dèng', 2]] },
    { c: '迟', meaning: '晚到', common: 3, imagery: ['从容'], pinyin: [['chí', 1]] },
    { c: '初', meaning: '开始', common: 4, imagery: ['初心', '初始'], pinyin: [['chū', 1]] },
    { c: '纯', meaning: '纯净', common: 4, imagery: ['纯粹'], pinyin: [['chún', 1]] },
    { c: '淳', meaning: '淳厚', common: 2, imagery: ['厚道', '质朴'], pinyin: [['chún', 1]] },
    { c: '川', meaning: '平地水流', common: 2, imagery: ['平易'], pinyin: [['chuān', 1]] },
    { c: '春', meaning: '春天', common: 5, imagery: ['生机', '更新'], pinyin: [['chūn', 1]] },
    { c: '达', meaning: '通达', common: 4, imagery: ['通达', '开阔'], pinyin: [['dá', 1]] },
    { c: '澹', meaning: '恬静、安稳', common: 1, imagery: ['恬淡', '安定'], pinyin: [['dàn', 1], ['tán', 2]] },
    { c: '岱', meaning: '泰山', common: 1, imagery: ['厚重', '稳峙'], pinyin: [['dài', 1]] },
    { c: '和', meaning: '和谐', common: 5, imagery: ['和合', '平和'], pinyin: [['hé', 1], ['hè', 2], ['huó', 3], ['huò', 4]] },
    { c: '禾', meaning: '谷物', common: 3, imagery: ['丰饶', '务实'], pinyin: [['hé', 1]] },
    { c: '衡', meaning: '平衡、衡量', common: 2, imagery: ['平衡', '权衡'], pinyin: [['héng', 1]] },
    { c: '怀', meaning: '心怀', common: 4, imagery: ['胸襟', '情怀'], pinyin: [['huái', 1]] },
    { c: '简', meaning: '简朴、简要', common: 4, imagery: ['简明', '克制'], pinyin: [['jiǎn', 1]] },
    { c: '见', meaning: '看见、见识', common: 4, imagery: ['见识'], pinyin: [['jiàn', 1], ['xiàn', 2]] },
    { c: '霁', meaning: '雨雪停止', common: 1, imagery: ['晴朗', '清明'], pinyin: [['jì', 1]] },
    { c: '静', meaning: '安静', common: 5, imagery: ['沉静', '专注'], pinyin: [['jìng', 1]] },
    { c: '瑾', meaning: '美玉', common: 2, imagery: ['美质', '珍贵'], pinyin: [['jǐn', 1]] },
    { c: '朗', meaning: '明朗、开朗', common: 4, imagery: ['明朗', '清朗'], pinyin: [['lǎng', 1]] },
    { c: '澜', meaning: '大波', common: 2, imagery: ['气象', '波澜'], pinyin: [['lán', 1]] },
    { c: '朗', meaning: '声音清楚', common: 3, imagery: ['清亮'], pinyin: [['lǎng', 1]] },
    { c: '乐', meaning: '快乐、音乐', common: 5, imagery: ['愉悦', '和乐'], pinyin: [['lè', 1], ['yuè', 2]] },
    { c: '砺', meaning: '磨刀石', common: 1, imagery: ['打磨', '精进'], pinyin: [['lì', 1]] },
    { c: '明', meaning: '明亮、通达', common: 5, imagery: ['明澈', '清醒'], pinyin: [['míng', 1]] },
    { c: '墨', meaning: '墨、书写', common: 4, imagery: ['文墨', '沉静'], pinyin: [['mò', 1]] },
    { c: '沐', meaning: '洗发、浸润', common: 2, imagery: ['润泽', '清新'], pinyin: [['mù', 1]] },
    { c: '南', meaning: '南方', common: 5, imagery: ['方位'], pinyin: [['nán', 1]] },
    { c: '宁', meaning: '安宁', common: 5, imagery: ['安宁', '宁和'], pinyin: [['níng', 1], ['nìng', 2]] },
    { c: '朴', meaning: '朴素、本真', common: 3, imagery: ['本真', '质朴'], pinyin: [['pǔ', 1], ['piáo', 2], ['pò', 3]] },
    { c: '其', meaning: '他的、那个', common: 4, imagery: ['沉静'], pinyin: [['qí', 1]] },
    { c: '清', meaning: '清澈', common: 5, imagery: ['清正', '澄明'], pinyin: [['qīng', 1]] },
    { c: '秋', meaning: '秋天', common: 4, imagery: ['成熟', '沉静'], pinyin: [['qiū', 1]] },
    { c: '容', meaning: '容纳、容貌', common: 5, imagery: ['包容', '从容'], pinyin: [['róng', 1]] },
    { c: '若', meaning: '如、好像', common: 5, imagery: ['从容', '柔和'], pinyin: [['ruò', 1]] },
    { c: '朔', meaning: '每月第一日', common: 1, imagery: ['起始', '清冷'], pinyin: [['shuò', 1]] },
    { c: '肃', meaning: '肃静、庄重', common: 2, imagery: ['庄重', '清肃'], pinyin: [['sù', 1]] },
    { c: '素', meaning: '本色、朴素', common: 4, imagery: ['素净', '本色'], pinyin: [['sù', 1]] },
    { c: '澈', meaning: '水清', common: 2, imagery: ['清澈'], pinyin: [['chè', 1]] },
    { c: '汀', meaning: '水边平地', common: 1, imagery: ['水岸', '安静'], pinyin: [['tīng', 1]] },
    { c: '望', meaning: '远望、期望', common: 4, imagery: ['远见', '期盼'], pinyin: [['wàng', 1]] },
    { c: '惟', meaning: '思考、只', common: 2, imagery: ['专注'], pinyin: [['wéi', 1]] },
    { c: '未', meaning: '未来、没有', common: 4, imagery: ['未竟', '可能性'], pinyin: [['wèi', 1]] },
    { c: '闻', meaning: '听到、闻名', common: 4, imagery: ['见闻', '通达'], pinyin: [['wén', 1]] },
    { c: '熙', meaning: '光明、和乐', common: 2, imagery: ['和暖', '光明'], pinyin: [['xī', 1]] },
    { c: '溪', meaning: '小河', common: 2, imagery: ['清澈', '流动'], pinyin: [['xī', 1]] },
    { c: '夏', meaning: '夏天', common: 5, imagery: ['热烈', '繁盛'], pinyin: [['xià', 1]] },
    { c: '闲', meaning: '空闲、悠闲', common: 4, imagery: ['从容', '留白'], pinyin: [['xián', 1]] },
    { c: '弦', meaning: '琴弦、弓弦', common: 2, imagery: ['张力', '音律'], pinyin: [['xián', 1]] },
    { c: '晓', meaning: '天亮、知道', common: 4, imagery: ['清明', '知晓'], pinyin: [['xiǎo', 1]] },
    { c: '歇', meaning: '休息', common: 3, imagery: ['休息', '张弛'], pinyin: [['xiē', 1]] },
    { c: '行', meaning: '行走、可以', common: 5, imagery: ['践行', '行进'], pinyin: [['xíng', 1], ['háng', 2]] },
    { c: '序', meaning: '次序', common: 3, imagery: ['秩序', '条理'], pinyin: [['xù', 1]] },
    { c: '砚', meaning: '砚台', common: 1, imagery: ['文墨', '沉静'], pinyin: [['yàn', 1]] },
    { c: '宜', meaning: '合适', common: 4, imagery: ['适宜', '分寸'], pinyin: [['yí', 1]] },
    { c: '域', meaning: '区域', common: 2, imagery: ['地域'], pinyin: [['yù', 1]] },
    { c: '毅', meaning: '果决', common: 3, imagery: ['坚毅'], pinyin: [['yì', 1]] },
    { c: '一', meaning: '一个', common: 5, imagery: ['专一'], pinyin: [['yī', 1], ['yí', 2], ['yì', 3]] },
    { c: '涌', meaning: '水涌', common: 3, imagery: ['涌流', '蓬勃'], pinyin: [['yǒng', 1]] },
    { c: '与', meaning: '和、同', common: 4, imagery: ['相与'], pinyin: [['yǔ', 1], ['yù', 2]] },
    { c: '屿', meaning: '小岛', common: 1, imagery: ['独立', '静立'], pinyin: [['yǔ', 1]] },
    { c: '远', meaning: '遥远', common: 5, imagery: ['远见', '辽阔'], pinyin: [['yuǎn', 1], ['yuàn', 2]] },
    { c: '昀', meaning: '日光', common: 1, imagery: ['日光', '温和'], pinyin: [['yún', 1]] },
    { c: '知', meaning: '知道', common: 5, imagery: ['知见', '明辨'], pinyin: [['zhī', 1]] },
    { c: '竹', meaning: '竹子', common: 4, imagery: ['清直', '谦逊'], pinyin: [['zhú', 1]] },
    { c: '澹', meaning: '水波', common: 1, imagery: ['恬静'], pinyin: [['dàn', 1]] },
    { c: '听', meaning: '听', common: 5, imagery: ['聆听'], pinyin: [['tīng', 1]] },
    { c: '长', meaning: '长、短', common: 5, imagery: ['长远'], pinyin: [['cháng', 1], ['zhǎng', 2]] },
    { c: '成', meaning: '完成', common: 5, imagery: ['成事'], pinyin: [['chéng', 1]] },
    { c: '舟', meaning: '小船', common: 2, imagery: ['渡行', '载物'], pinyin: [['zhōu', 1]] },
    { c: '禾', meaning: '稻谷', common: 2, imagery: ['务实'], pinyin: [['hé', 1]] },
    { c: '禾', meaning: '和顺', common: 2, imagery: ['和顺'], pinyin: [['hé', 1]] },
    { c: '同', meaning: '相同', common: 5, imagery: ['同频'], pinyin: [['tóng', 1]] },
    { c: '见', meaning: '显现', common: 3, imagery: ['显现'], pinyin: [['jiàn', 1]] },
    { c: '方', meaning: '方形、方法', common: 5, imagery: ['方法', '端正'], pinyin: [['fāng', 1]] },
    { c: '嘉', meaning: '美好、嘉许', common: 4, imagery: ['美好', '嘉许'], pinyin: [['jia', 1]] },
    { c: '睿', meaning: '聪明睿智', common: 4, imagery: ['睿智', '明辨'], pinyin: [['rui', 1]] },
    { c: '哲', meaning: '有智慧', common: 4, imagery: ['哲思', '明辨'], pinyin: [['zhe', 1]] },
    { c: '维', meaning: '维系', common: 3, imagery: ['维系', '思考'], pinyin: [['wei', 1]] },
    { c: '斯', meaning: '这、则', common: 4, imagery: ['文气'], pinyin: [['si', 1]] },
    { c: '言', meaning: '言语', common: 4, imagery: ['言说', '文气'], pinyin: [['yan', 1]] },
    { c: '语', meaning: '语言', common: 5, imagery: ['言说'], pinyin: [['yu', 1]] },
    { c: '识', meaning: '见识', common: 3, imagery: ['见识'], pinyin: [['shi', 1], ['zhi', 2]] },
    { c: '理', meaning: '道理、治理', common: 5, imagery: ['条理', '治理'], pinyin: [['li', 1]] },
    { c: '章', meaning: '文章、法度', common: 4, imagery: ['文气', '法度'], pinyin: [['zhang', 1]] },
    { c: '法', meaning: '方法、法度', common: 4, imagery: ['法度', '方法'], pinyin: [['fa', 1]] },
    { c: '度', meaning: '尺度', common: 4, imagery: ['分寸', '尺度'], pinyin: [['du', 1], ['duo', 2]] },
    { c: '衡', meaning: '衡量', common: 2, imagery: ['权衡', '平衡'], pinyin: [['heng', 1]] },
    { c: '鼎', meaning: '鼎立', common: 2, imagery: ['厚重', '稳峙'], pinyin: [['ding', 1]] },
    { c: '磐', meaning: '厚重石头', common: 1, imagery: ['厚重', '稳固'], pinyin: [['pan', 1]] },
    { c: '岳', meaning: '高山', common: 2, imagery: ['厚重', '稳峙'], pinyin: [['yue', 1]] },
    { c: '崇', meaning: '崇高', common: 3, imagery: ['稳重', '崇高'], pinyin: [['chong', 1]] },
    { c: '稳', meaning: '稳定', common: 4, imagery: ['稳定', '稳重'], pinyin: [['wen', 1]] },
    { c: '健', meaning: '强健', common: 4, imagery: ['强健', '稳定'], pinyin: [['jian', 1]] },
    { c: '刚', meaning: '刚强', common: 3, imagery: ['刚直'], pinyin: [['gang', 1]] },
    { c: '直', meaning: '正直', common: 4, imagery: ['刚直', '坦白'], pinyin: [['zhi', 1]] },
    { c: '诚', meaning: '诚实', common: 4, imagery: ['诚实', '坦白'], pinyin: [['cheng', 1]] },
    { c: '实', meaning: '实在', common: 5, imagery: ['务实', '实在'], pinyin: [['shi', 1]] },
    { c: '务', meaning: '事务', common: 4, imagery: ['务实'], pinyin: [['wu', 1]] },
    { c: '本', meaning: '根本', common: 5, imagery: ['务实', '本真'], pinyin: [['ben', 1]] },
    { c: '质', meaning: '本质', common: 3, imagery: ['本质', '实在'], pinyin: [['zhi', 1]] },
    { c: '源', meaning: '源头', common: 4, imagery: ['源头', '本真'], pinyin: [['yuan', 1]] },
    { c: '真', meaning: '真实', common: 5, imagery: ['本真', '真实'], pinyin: [['zhen', 1]] },
    { c: '暖', meaning: '温暖', common: 5, imagery: ['和暖', '亲切'], pinyin: [['nuan', 1]] },
    { c: '亲', meaning: '亲近', common: 4, imagery: ['亲切', '烟火'], pinyin: [['qin', 1]] },
    { c: '灶', meaning: '灶台', common: 1, imagery: ['烟火'], pinyin: [['zao', 1]] },
    { c: '味', meaning: '味道', common: 4, imagery: ['烟火', '滋味'], pinyin: [['wei', 1]] },
    { c: '谷', meaning: '谷物', common: 3, imagery: ['丰饶'], pinyin: [['gu', 1]] },
    { c: '丰', meaning: '丰盛', common: 4, imagery: ['丰饶', '繁盛'], pinyin: [['feng', 1]] },
    { c: '登', meaning: '登高', common: 4, imagery: ['上升', '进取'], pinyin: [['deng', 1]] },
    { c: '临', meaning: '面临', common: 3, imagery: ['面对'], pinyin: [['lin', 1]] },
    { c: '越', meaning: '超越', common: 3, imagery: ['进取'], pinyin: [['yue', 1]] },
    { c: '新', meaning: '新', common: 5, imagery: ['更新', '创新'], pinyin: [['xin', 1]] },
    { c: '创', meaning: '创造', common: 4, imagery: ['创新', '开拓'], pinyin: [['chuang', 1]] },
    { c: '拓', meaning: '开拓', common: 2, imagery: ['开拓', '拓展'], pinyin: [['tuo', 1]] },
    { c: '晰', meaning: '清楚', common: 2, imagery: ['明晰'], pinyin: [['xi', 1]] },
    { c: '用', meaning: '实用', common: 5, imagery: ['实用'], pinyin: [['yong', 1]] },
    { c: '简', meaning: '简洁', common: 4, imagery: ['简洁', '简明'], pinyin: [['jian', 1]] },
    { c: '洁', meaning: '整洁', common: 3, imagery: ['简洁', '素净'], pinyin: [['jie', 1]] },
    { c: '素', meaning: '素雅', common: 4, imagery: ['素雅', '留白'], pinyin: [['su', 1]] },
    { c: '雅', meaning: '雅致', common: 4, imagery: ['雅致', '文气'], pinyin: [['ya', 1]] },
    { c: '致', meaning: '精致', common: 4, imagery: ['精致', '雅致'], pinyin: [['zhi', 1]] },
    { c: '细', meaning: '细致', common: 4, imagery: ['细致', '慎重'], pinyin: [['xi', 1]] },
    { c: '琢', meaning: '雕琢', common: 1, imagery: ['打磨', '琢磨'], pinyin: [['zhuo', 1]] },
    { c: '磨', meaning: '磨砺', common: 2, imagery: ['打磨'], pinyin: [['mo', 1]] },
    { c: '叙', meaning: '叙述', common: 2, imagery: ['叙述'], pinyin: [['xu', 1]] },
    { c: '事', meaning: '事务', common: 5, imagery: ['事务', '做事'], pinyin: [['shi', 1]] },
    { c: '工', meaning: '精密工作', common: 5, imagery: ['精工'], pinyin: [['gong', 1]] },
    { c: '艺', meaning: '技艺', common: 4, imagery: ['技艺', '文墨'], pinyin: [['yi', 1]] },
    { c: '作', meaning: '作品', common: 5, imagery: ['创作'], pinyin: [['zuo', 1]] },
    { c: '构', meaning: '构建', common: 3, imagery: ['构建'], pinyin: [['gou', 1]] },
    { c: '建', meaning: '建立', common: 4, imagery: ['构建', '建立'], pinyin: [['jian', 1]] },
    { c: '立', meaning: '建立', common: 4, imagery: ['建立', '立身'], pinyin: [['li', 1]] },
    { c: '身', meaning: '自身', common: 5, imagery: ['立身'], pinyin: [['shen', 1]] },
    { c: '端', meaning: '端正', common: 4, imagery: ['端正', '开端'], pinyin: [['duan', 1]] },
    { c: '正', meaning: '端正', common: 5, imagery: ['端正', '刚直', '清正'], pinyin: [['zheng', 1]] },
    { c: '方', meaning: '方正', common: 4, imagery: ['方正', '端正', '方法'], pinyin: [['fang', 1]] },
    { c: '规', meaning: '规则', common: 3, imagery: ['规度'], pinyin: [['gui', 1]] },
    { c: '矩', meaning: '矩尺', common: 2, imagery: ['规度'], pinyin: [['ju', 1]] },
    { c: '准', meaning: '准确', common: 4, imagery: ['准确'], pinyin: [['zhun', 1]] },
    { c: '确', meaning: '确实', common: 3, imagery: ['确切'], pinyin: [['que', 1]] },
    { c: '信', meaning: '诚信', common: 5, imagery: ['诚信', '可信', '守信'], pinyin: [['xin', 1]] },
    { c: '誉', meaning: '信誉', common: 2, imagery: ['信誉', '称誉'], pinyin: [['yu', 1]] },
    { c: '声', meaning: '声音', common: 5, imagery: ['声音', '声响'], pinyin: [['sheng', 1]] },
    { c: '名', meaning: '名声', common: 5, imagery: ['名声', '名望'], pinyin: [['ming', 1]] },
    { c: '廉', meaning: '廉洁', common: 2, imagery: ['清正'], pinyin: [['lian', 1]] },
    { c: '朴', meaning: '朴实', common: 3, imagery: ['朴实', '本真'], pinyin: [['pu', 1], ['piao', 2], ['po', 3]] },
    { c: '心', meaning: '心', common: 5, imagery: ['用心'], pinyin: [['xin', 1]] },
    { c: '念', meaning: '念头、纪念', common: 4, imagery: ['念头', '纪念'], pinyin: [['nian', 1]] },
    { c: '梦', meaning: '梦想', common: 4, imagery: ['梦想'], pinyin: [['meng', 1]] },
    { c: '想', meaning: '思想', common: 5, imagery: ['思想'], pinyin: [['xiang', 1]] },
    { c: '希', meaning: '希望', common: 4, imagery: ['希望'], pinyin: [['xi', 1]] },
    { c: '遇', meaning: '遇见', common: 4, imagery: ['遇见', '知遇'], pinyin: [['yu', 1]] },
    { c: '惜', meaning: '珍惜', common: 3, imagery: ['珍惜'], pinyin: [['xi', 1]] },
    { c: '诺', meaning: '承诺', common: 3, imagery: ['承诺'], pinyin: [['nuo', 1]] },
    { c: '承', meaning: '承当', common: 4, imagery: ['承当', '承担'], pinyin: [['cheng', 1]] },
    { c: '担', meaning: '承担', common: 4, imagery: ['承担'], pinyin: [['dan', 1]] },
    { c: '守', meaning: '守护', common: 4, imagery: ['守护'], pinyin: [['shou', 1]] },
    { c: '义', meaning: '义气', common: 4, imagery: ['义气'], pinyin: [['yi', 1]] },
    { c: '仁', meaning: '仁厚', common: 3, imagery: ['仁厚'], pinyin: [['ren', 1]] },
    { c: '厚', meaning: '厚道、深厚', common: 4, imagery: ['厚道', '深厚', '厚重'], pinyin: [['hou', 1]] },
    { c: '德', meaning: '德行', common: 3, imagery: ['德行'], pinyin: [['de', 1]] },
    { c: '善', meaning: '善良', common: 4, imagery: ['善良', '良善'], pinyin: [['shan', 1]] },
    { c: '良', meaning: '良好', common: 4, imagery: ['良善'], pinyin: [['liang', 1]] },
    { c: '美', meaning: '美好', common: 5, imagery: ['美好'], pinyin: [['mei', 1]] },
    { c: '欣', meaning: '欣喜', common: 3, imagery: ['欣喜'], pinyin: [['xin', 1]] },
    { c: '悦', meaning: '愉悦', common: 3, imagery: ['愉悦'], pinyin: [['yue', 1]] },
    { c: '欢', meaning: '欢乐', common: 4, imagery: ['欢乐'], pinyin: [['huan', 1]] },
    { c: '舒', meaning: '舒展', common: 3, imagery: ['舒展'], pinyin: [['shu', 1]] },
    { c: '畅', meaning: '畅快、通畅', common: 3, imagery: ['畅快', '通畅', '顺畅'], pinyin: [['chang', 1]] },
    { c: '今', meaning: '今日', common: 4, imagery: ['当下'], pinyin: [['jin', 1]] },
    { c: '朝', meaning: '早晨、朝气', common: 4, imagery: ['清晨', '朝气'], pinyin: [['zhao', 1], ['chao', 2]] },
    { c: '暮', meaning: '傍晚', common: 2, imagery: ['黄昏'], pinyin: [['mu', 1]] },
    { c: '星', meaning: '星辰', common: 4, imagery: ['星辰'], pinyin: [['xing', 1]] },
    { c: '月', meaning: '月亮', common: 5, imagery: ['月明'], pinyin: [['yue', 1]] },
    { c: '云', meaning: '云', common: 4, imagery: ['云气'], pinyin: [['yun', 1]] },
    { c: '风', meaning: '风', common: 5, imagery: ['风'], pinyin: [['feng', 1]] },
    { c: '雨', meaning: '雨', common: 4, imagery: ['雨润'], pinyin: [['yu', 1]] },
    { c: '雪', meaning: '雪', common: 3, imagery: ['素净'], pinyin: [['xue', 1]] },
    { c: '露', meaning: '露水', common: 2, imagery: ['润泽'], pinyin: [['lu', 1]] },
    { c: '雷', meaning: '雷', common: 3, imagery: ['震动'], pinyin: [['lei', 1]] },
    { c: '光', meaning: '光', common: 4, imagery: ['光明', '明亮'], pinyin: [['guang', 1]] },
    { c: '亮', meaning: '明亮', common: 4, imagery: ['明亮'], pinyin: [['liang', 1]] },
    { c: '晖', meaning: '阳光', common: 2, imagery: ['和暖'], pinyin: [['hui', 1]] },
    { c: '旭', meaning: '初升太阳', common: 2, imagery: ['初升'], pinyin: [['xu', 1]] },
    { c: '气', meaning: '气息', common: 4, imagery: ['气息', '朝气'], pinyin: [['qi', 1]] },
    { c: '韵', meaning: '韵味', common: 3, imagery: ['韵味', '雅致'], pinyin: [['yun', 1]] },
    { c: '音', meaning: '声音', common: 4, imagery: ['音律'], pinyin: [['yin', 1]] },
    { c: '律', meaning: '律动', common: 2, imagery: ['音律', '规度'], pinyin: [['lv', 1]] },
    { c: '鸣', meaning: '鸣叫', common: 2, imagery: ['声响'], pinyin: [['ming', 1]] },
    { c: '岚', meaning: '山间雾气', common: 1, imagery: ['清岚', '山气'], pinyin: [['lan', 1]] },
    { c: '峰', meaning: '山峰', common: 3, imagery: ['山峰', '高远'], pinyin: [['feng', 1]] },
    { c: '岭', meaning: '山岭', common: 2, imagery: ['高远'], pinyin: [['ling', 1]] },
    { c: '原', meaning: '原野', common: 3, imagery: ['辽阔', '原野'], pinyin: [['yuan', 1]] },
    { c: '野', meaning: '原野', common: 4, imagery: ['原野', '自在'], pinyin: [['ye', 1]] },
    { c: '阔', meaning: '宽阔', common: 3, imagery: ['开阔', '辽阔'], pinyin: [['kuo', 1]] },
    { c: '广', meaning: '广大', common: 4, imagery: ['开阔'], pinyin: [['guang', 1]] },
    { c: '深', meaning: '深', common: 4, imagery: ['深厚', '深远'], pinyin: [['shen', 1]] },
    { c: '重', meaning: '厚重', common: 3, imagery: ['厚重'], pinyin: [['zhong', 1], ['chong', 2]] },
    { c: '沉', meaning: '沉稳', common: 4, imagery: ['沉稳'], pinyin: [['chen', 1]] },
    { c: '谨', meaning: '谨慎', common: 2, imagery: ['谨慎'], pinyin: [['jin', 1]] },
    { c: '慎', meaning: '慎重', common: 3, imagery: ['谨慎', '慎重'], pinyin: [['shen', 1]] },
    { c: '密', meaning: '周密', common: 2, imagery: ['周密'], pinyin: [['mi', 1]] },
    { c: '周', meaning: '周全', common: 4, imagery: ['周全'], pinyin: [['zhou', 1]] },
    { c: '全', meaning: '周全、圆满', common: 5, imagery: ['周全', '圆满'], pinyin: [['quan', 1]] },
    { c: '定', meaning: '安定', common: 4, imagery: ['安定'], pinyin: [['ding', 1]] },
    { c: '适', meaning: '舒适、适宜', common: 3, imagery: ['舒适', '适宜', '相宜'], pinyin: [['shi', 1]] },
    { c: '宜', meaning: '相宜', common: 4, imagery: ['适宜', '相宜'], pinyin: [['yi', 1]] },
    { c: '融', meaning: '融合', common: 3, imagery: ['融合'], pinyin: [['rong', 1]] },
    { c: '合', meaning: '和合', common: 4, imagery: ['和合'], pinyin: [['he', 1]] },
    { c: '共', meaning: '共同', common: 5, imagery: ['共同'], pinyin: [['gong', 1]] },
    { c: '伴', meaning: '同伴', common: 3, imagery: ['同伴'], pinyin: [['ban', 1]] },
    { c: '连', meaning: '连接', common: 4, imagery: ['连接', '连通'], pinyin: [['lian', 1]] },
    { c: '接', meaning: '连接', common: 4, imagery: ['连接'], pinyin: [['jie', 1]] },
    { c: '通', meaning: '通达、顺畅', common: 4, imagery: ['通达', '连通', '顺畅'], pinyin: [['tong', 1]] },
    { c: '流', meaning: '流动', common: 4, imagery: ['流动'], pinyin: [['liu', 1]] },
    { c: '动', meaning: '流动、行动', common: 5, imagery: ['流动', '行动'], pinyin: [['dong', 1]] },
    { c: '为', meaning: '作为', common: 5, imagery: ['作为'], pinyin: [['wei', 1]] },
    { c: '做', meaning: '做事', common: 5, imagery: ['做事'], pinyin: [['zuo', 1]] },
    { c: '业', meaning: '事业', common: 4, imagery: ['事业'], pinyin: [['ye', 1]] },
    { c: '功', meaning: '功成', common: 4, imagery: ['功成'], pinyin: [['gong', 1]] },
    { c: '志', meaning: '志向', common: 4, imagery: ['志向'], pinyin: [['zhi', 1]] },
    { c: '向', meaning: '方向', common: 5, imagery: ['方向'], pinyin: [['xiang', 1]] },
    { c: '道', meaning: '道路、道义', common: 5, imagery: ['道路', '道义'], pinyin: [['dao', 1]] },
    { c: '路', meaning: '道路', common: 4, imagery: ['道路'], pinyin: [['lu', 1]] },
    { c: '途', meaning: '路径', common: 3, imagery: ['路径'], pinyin: [['tu', 1]] },
    { c: '程', meaning: '过程', common: 4, imagery: ['过程'], pinyin: [['cheng', 1]] },
    { c: '步', meaning: '脚步', common: 5, imagery: ['脚步', '行动'], pinyin: [['bu', 1]] },
    { c: '展', meaning: '发展', common: 4, imagery: ['展开', '发展'], pinyin: [['zhan', 1]] },
    { c: '开', meaning: '开始、开拓', common: 5, imagery: ['开始', '开拓'], pinyin: [['kai', 1]] },
    { c: '发', meaning: '发展', common: 5, imagery: ['发展'], pinyin: [['fa', 1]] },
    { c: '生', meaning: '生长', common: 5, imagery: ['生长', '生机'], pinyin: [['sheng', 1]] },
    { c: '长', meaning: '生长、长远', common: 4, imagery: ['长远', '生长'], pinyin: [['chang', 1], ['zhang', 2]] },
    { c: '育', meaning: '培育、启迪', common: 3, imagery: ['培育', '启迪'], pinyin: [['yu', 1]] },
    { c: '养', meaning: '养育、滋养', common: 4, imagery: ['养育', '滋养'], pinyin: [['yang', 1]] },
    { c: '润', meaning: '润泽', common: 3, imagery: ['滋养', '润泽'], pinyin: [['run', 1]] },
    { c: '泽', meaning: '恩泽', common: 3, imagery: ['润泽'], pinyin: [['ze', 1]] },
    { c: '盈', meaning: '充盈', common: 2, imagery: ['充盈'], pinyin: [['ying', 1]] },
    { c: '满', meaning: '圆满', common: 4, imagery: ['圆满', '充盈'], pinyin: [['man', 1]] },
    { c: '祥', meaning: '吉祥', common: 3, imagery: ['吉祥'], pinyin: [['xiang', 1]] },
    { c: '瑞', meaning: '祥瑞', common: 3, imagery: ['祥瑞'], pinyin: [['rui', 1]] },
    { c: '福', meaning: '福气', common: 4, imagery: ['福气'], pinyin: [['fu', 1]] },
    { c: '寿', meaning: '长寿', common: 3, imagery: ['长久'], pinyin: [['shou', 1]] },
    { c: '康', meaning: '安康', common: 3, imagery: ['安康'], pinyin: [['kang', 1]] },
    { c: '泰', meaning: '安泰', common: 2, imagery: ['安泰', '通泰'], pinyin: [['tai', 1]] },
    { c: '平', meaning: '平和', common: 5, imagery: ['平和'], pinyin: [['ping', 1]] },
    { c: '均', meaning: '均衡', common: 2, imagery: ['均衡'], pinyin: [['jun', 1]] },
    { c: '顺', meaning: '顺遂', common: 4, imagery: ['顺遂'], pinyin: [['shun', 1]] },
    { c: '遂', meaning: '顺遂', common: 2, imagery: ['顺遂'], pinyin: [['sui', 1]] },
    { c: '舟', meaning: '小船', common: 2, imagery: ['渡行', '载物'], pinyin: [['zhou', 1]] },
    { c: '岸', meaning: '水边', common: 3, imagery: ['水岸'], pinyin: [['an', 1]] },
    { c: '汀', meaning: '水边平地', common: 1, imagery: ['水岸', '安静'], pinyin: [['ting', 1]] },
    { c: '洲', meaning: '水中陆地', common: 2, imagery: ['水岸'], pinyin: [['zhou', 1]] },
    { c: '禾', meaning: '和顺', common: 2, imagery: ['和顺'], pinyin: [['he', 1]] },
    { c: '稚', meaning: '稚嫩', common: 2, imagery: ['稚嫩'], pinyin: [['zhi', 1]] },
    
    { c: '新', meaning: '朝气', common: 3, imagery: ['朝气', '创新'], pinyin: [['xin', 1]] },
    { c: '茂', meaning: '茂盛', common: 2, imagery: ['繁盛', '生长'], pinyin: [['mao', 1]] },
    { c: '盛', meaning: '繁盛', common: 3, imagery: ['繁盛', '热闹'], pinyin: [['sheng', 1]] },
    { c: '繁', meaning: '繁多', common: 3, imagery: ['繁盛'], pinyin: [['fan', 1]] },
    { c: '闹', meaning: '热闹', common: 3, imagery: ['热闹', '烟火'], pinyin: [['nao', 1]] },
    { c: '市', meaning: '市集', common: 4, imagery: ['市井', '烟火'], pinyin: [['shi', 4]] },
    { c: '井', meaning: '水井', common: 3, imagery: ['市井'], pinyin: [['jing', 1]] },
    { c: '厨', meaning: '厨房', common: 3, imagery: ['烟火'], pinyin: [['chu', 1]] },
    { c: '茶', meaning: '茶', common: 4, imagery: ['清苦', '雅致'], pinyin: [['cha', 1]] },
    { c: '酒', meaning: '酒', common: 4, imagery: ['烟火'], pinyin: [['jiu', 1]] },
    { c: '书', meaning: '书', common: 5, imagery: ['文墨', '书卷'], pinyin: [['shu', 1]] },
    { c: '卷', meaning: '书卷', common: 3, imagery: ['书卷'], pinyin: [['juan', 1], ['quan', 2]] },
    { c: '卷', meaning: '卷动', common: 2, imagery: ['卷动'], pinyin: [['juan', 1], ['quan', 2]] },
    { c: '墨', meaning: '墨', common: 4, imagery: ['文墨', '沉静'], pinyin: [['mo', 1]] },
    { c: '笔', meaning: '笔', common: 4, imagery: ['文墨'], pinyin: [['bi', 1]] },
    { c: '纸', meaning: '纸', common: 3, imagery: ['文墨'], pinyin: [['zhi', 1]] },
    { c: '画', meaning: '画', common: 4, imagery: ['技艺', '留白'], pinyin: [['hua', 1], ['hua4', 2]] },
    { c: '琴', meaning: '琴', common: 3, imagery: ['音律', '雅致'], pinyin: [['qin', 1]] },
    { c: '棋', meaning: '棋', common: 3, imagery: ['博弈'], pinyin: [['qi', 1]] },
    { c: '灯', meaning: '灯', common: 4, imagery: ['光明', '和暖'], pinyin: [['deng', 1]] },
    { c: '火', meaning: '火', common: 4, imagery: ['热闹', '明快'], pinyin: [['huo', 1]] },
    { c: '木', meaning: '木', common: 4, imagery: ['本真', '生长'], pinyin: [['mu', 1]] },
    { c: '土', meaning: '土', common: 3, imagery: ['务实'], pinyin: [['tu', 1]] },
    { c: '金', meaning: '金', common: 3, imagery: ['贵重'], pinyin: [['jin', 1]] },
    { c: '玉', meaning: '玉', common: 3, imagery: ['美质', '贵重'], pinyin: [['yu', 1]] },
    { c: '石', meaning: '石', common: 3, imagery: ['厚重', '稳固'], pinyin: [['shi', 1]] },
    { c: '泉', meaning: '泉水', common: 2, imagery: ['清冽', '源头'], pinyin: [['quan', 1]] },
    { c: '林', meaning: '树林', common: 4, imagery: ['繁盛', '生长'], pinyin: [['lin', 1]] },
    { c: '森', meaning: '森林', common: 2, imagery: ['繁盛', '深'], pinyin: [['sen', 1]] },
    { c: '野', meaning: '自在', common: 3, imagery: ['自在'], pinyin: [['ye', 1]] },
    { c: '悠', meaning: '悠然', common: 3, imagery: ['悠然', '从容'], pinyin: [['you', 1]] },
    { c: '然', meaning: '自然、然而', common: 5, imagery: ['自然', '本真'], pinyin: [['ran', 1]] },
    { c: '自', meaning: '自然', common: 5, imagery: ['自然', '自在'], pinyin: [['zi', 1]] },
    { c: '在', meaning: '存在', common: 5, imagery: ['存在'], pinyin: [['zai', 1]] },
    { c: '游', meaning: '游历', common: 3, imagery: ['游历', '自在'], pinyin: [['you', 1]] },
    { c: '行', meaning: '可行、践行', common: 4, imagery: ['可行', '践行', '行动'], pinyin: [['xing', 1], ['hang', 2]] },
    { c: '旅', meaning: '旅行', common: 3, imagery: ['行旅'], pinyin: [['lv', 1]] },
    { c: '途', meaning: '旅途', common: 2, imagery: ['行旅'], pinyin: [['tu', 1]] },
    { c: '程', meaning: '路程', common: 2, imagery: ['路程'], pinyin: [['cheng', 1]] }
  ];

  /* 去重：保留第一个同字定义 */
  var CHAR_INDEX = (function () {
    var map = Object.create(null);
    CHARS.forEach(function (x) { if (!map[x.c]) map[x.c] = x; });
    return map;
  })();
  var UNIQUE_CHARS = Object.keys(CHAR_INDEX).map(function (k) { return CHAR_INDEX[k]; });

  /* 姓氏：只收常见单姓与复姓，用于长度计算与音节判断 */
  var SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '高', '罗',
    '郑', '梁', '谢', '宋', '唐', '许', '邓', '冯', '韩', '曹', '曾', '彭', '萧', '蔡', '潘', '田', '董', '袁', '于', '余',
    '叶', '蒋', '杜', '苏', '魏', '程', '吕', '丁', '沈', '任', '姚', '卢', '傅', '钟', '姜', '崔', '谭', '廖', '范', '汪',
    '陆', '金', '石', '戴', '贾', '韦', '夏', '邱', '方', '侯', '邹', '熊', '孟', '秦', '白', '江', '阎', '薛', '尹', '段',
    '欧阳', '司马', '上官', '诸葛', '东方', '独孤', '南宫', '西门', '夏侯', '皇甫'];

  var IMAGERY_TAGS = ['安定', '从容', '长青', '清朗', '纯粹', '开阔', '清澄', '明澈', '初心', '通达', '平和', '和合', '平衡', '胸襟',
    '简明', '克制', '见识', '晴朗', '沉静', '专注', '美质', '明朗', '愉悦', '打磨', '明澈', '清醒', '文墨', '润泽', '安宁',
    '本真', '清正', '澄明', '包容', '庄重', '素净', '本色', '清澈', '远见', '期盼', '未竟', '可能', '见闻', '和暖', '留白',
    '清明', '知晓', '张弛', '践行', '秩序', '文墨', '适宜', '坚毅', '专一', '相与', '独立', '辽阔', '知见', '清直', '谦逊'];

  var STYLES = [
    { key: 'calm', label: '沉静克制', tags: ['沉静', '克制', '素净', '本色', '安静'], note: '用字不张扬，重在可长期使用' },
    { key: 'bright', label: '明朗开阔', tags: ['明朗', '开阔', '晴朗', '清朗', '辽阔'], note: '用字明亮，适合外向表达' },
    { key: 'classic', label: '文气书卷', tags: ['文墨', '书卷', '清直', '远见', '知见'], note: '偏书面语气质，适合需要可信度的场合' },
    { key: 'steady', label: '稳厚重实', tags: ['厚重', '平衡', '安定', '坚毅', '务实'], note: '稳重可靠，不轻浮' },
    { key: 'rare', label: '少见独特', tags: [], note: '刻意避开高频用字，代价是他人不易读' },
    { key: 'plain', label: '常见易读', tags: [], note: '优先高频字，别人一眼能读对' }
  ];

  /* 常见谐音风险：只标注真实存在的高频误读，不编造 */
  var HOMOPHONE_RISK = {
    '和': '与"喝""和面"同音，口语环境可能被听错',
    '行': 'xíng / háng 两读，姓氏与"银行"语境易混',
    '长': 'cháng / zhǎng 两读，名字中常被读错',
    '乐': 'lè / yuè 两读，作名字时多数人读 lè，但"音乐"语境会读 yuè',
    '一': 'yī / yí / yì 三读，声调变化明显',
    '宁': 'níng / nìng 两读，后者仅见于特定词',
    '见': 'jiàn / xiàn 两读，"现"义时读 xiàn',
    '朴': 'pǔ / piáo / pò 三读，姓氏中读 piáo',
    '柏': 'bǎi / bó / bò 三读，"柏林"读 bó',
    '朝': 'zhāo / cháo 两读，早晨义读 zhāo',
    '重': 'zhòng / chóng 两读，"重新"读 chóng',
    '度': 'dù / duó 两读，"揣度"读 duó'
  };

  /* 常见姓氏，避免生成"王静"这类过泛组合时的提示 */
  var SURNAME_COMMON = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '李', '张'];

  /* ------------------------------------------------------------ 公司 / 品牌 */

  var INDUSTRIES = [
    { key: 'design', label: '设计工作室', tone: ['简明', '审美', '克制'], note: '客户多为年轻人，名字不宜过于厚重' },
    { key: 'tech', label: '科技公司', tone: ['明澈', '远见', '通达'], note: '需要可读性与可信度，谐音风险代价高' },
    { key: 'food', label: '餐饮', tone: ['丰饶', '亲切', '烟火'], note: '重口味与记忆点，长度不宜超过 4 字' },
    { key: 'edu', label: '教育', tone: ['知见', '耐心', '启迪'], note: '信任优先，避免夸张用词' },
    { key: 'studio', label: '内容 / 文创', tone: ['文墨', '个性', '留白'], note: '允许一定程度的主观表达' },
    { key: 'trade', label: '贸易 / 供应链', tone: ['务实', '稳厚', '通达'], note: '以可核对与易记为准' }
  ];

  var REGIONS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州'];

  /* ---------------------------------------------------------- 笔画与五格 */

  /* 笔画与五格属文化选项，单列展示，不主导实用推荐。
   * 这里只提供字形标准说明与"尚未接入"的如实标注，不生成吉凶分数。 */
  var STROKE_POLICY = {
    available: false,
    reason: '本轮未接入康熙字典笔画与五格数据源。为避免给出无法核对的分数，此处不显示笔画与五格结论。',
    standardNote: '若后续提供，将采用康熙字典笔画为字形标准（与大陆现行规范笔画可能不同），并在界面中同时标注两套笔画。'
  };

  /* ------------------------------------------------------------ 生成 */

  function normalize(input) {
    var kind = ['person', 'company', 'brand'].indexOf(input.kind) >= 0 ? input.kind : 'person';
    var out = { kind: kind };
    if (kind === 'person') {
      out.surname = String(input.surname || '').trim();
      out.givenLength = Number(input.givenLength) || 2;
      out.imagery = Array.isArray(input.imagery) ? input.imagery : [];
      out.style = String(input.style || '');
      out.forbidden = String(input.forbidden || '').replace(/\s+/g, '');
      out.taboo = Array.isArray(input.taboo) ? input.taboo : [];
      out.rarity = String(input.rarity || 'any');
      out.pinyinChoice = Object.assign({}, input.pinyinChoice || {});
      out.birthProvided = !!input.birthProvided;
    } else if (kind === 'company') {
      out.industry = String(input.industry || '');
      out.region = String(input.region || '');
      out.audience = String(input.audience || '');
      out.tone = String(input.tone || '');
      out.length = Number(input.length) || 4;
      out.forbidden = String(input.forbidden || '').replace(/\s+/g, '');
      out.legalName = String(input.legalName || '').trim();
    } else {
      out.category = String(input.category || '');
      out.tone = String(input.tone || '');
      out.length = Number(input.length) || 3;
      out.forbidden = String(input.forbidden || '').replace(/\s+/g, '');
    }
    return out;
  }

  /* 有效字池。
   *
   * 只有禁用字与避讳字是硬过滤（必须严格生效）。
   * 意象、风格、常见程度改为软评分：先排除硬冲突，再按符合度排序取字。
   * 这样条件仍然生效，但不会因为多个条件同时收紧而把字池压到无法组合。
   * 条件是否生效由 matchReasons 如实说明，不靠"筛不出来"来暗示。
   */
  function poolFor(norm) {
    var taboo = (norm.taboo || []).join('');
    var forbidden = norm.forbidden || '';
    var style = null;
    STYLES.forEach(function (s) { if (s.key === norm.style) style = s; });
    var imagery = norm.imagery || [];

    var scored = UNIQUE_CHARS.filter(function (x) {
      /* 硬过滤：禁用字与避讳字 */
      if (forbidden.indexOf(x.c) >= 0) return false;
      if (taboo.indexOf(x.c) >= 0) return false;
      return true;
    }).map(function (x) {
      var score = 0;
      var hits = [];
      /* 意象匹配 */
      imagery.forEach(function (tag) {
        if (x.imagery.indexOf(tag) >= 0) { score += 6; hits.push(tag); }
        else if (tag === x.meaning) { score += 5; hits.push(tag); }
      });
      /* 风格匹配 */
      if (style && style.tags.length && style.tags.some(function (t) { return x.imagery.indexOf(t) >= 0; })) {
        score += 3;
      }
      /* 常见程度：rare 偏好低频，plain 偏好高频，any 不加权 */
      if (norm.rarity === 'rare') score += (5 - x.common) * 2;
      else if (norm.rarity === 'plain') score += x.common * 2;
      else score += x.common; /* 默认略偏好常用字，避免生僻 */
      return { c: x.c, score: score, hits: hits };
    });

    /* 按分数降序；同分按字形稳定排序，保证同一输入结果一致 */
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.c < b.c ? -1 : (a.c > b.c ? 1 : 0);
    });
    return scored.map(function (x) { return x.c; });
  }

  /* 某组用字对输入条件的命中情况，供解释如实引用。 */
  function matchReport(norm, chars) {
    var imagery = norm.imagery || [];
    var style = null;
    STYLES.forEach(function (s) { if (s.key === norm.style) style = s; });
    var hitImagery = [];
    var missImagery = [];
    imagery.forEach(function (tag) {
      var found = chars.some(function (c) {
        var info = CHAR_INDEX[c];
        return info && (info.imagery.indexOf(tag) >= 0 || info.meaning === tag);
      });
      (found ? hitImagery : missImagery).push(tag);
    });
    var styleHit = style && style.tags.length
      ? chars.some(function (c) {
        var info = CHAR_INDEX[c];
        return info && style.tags.some(function (t) { return info.imagery.indexOf(t) >= 0; });
      })
      : null;
    return {
      hitImagery: hitImagery,
      missImagery: missImagery,
      styleHit: styleHit,
      styleLabel: style ? style.label : ''
    };
  }

  /* 确定性生成：同一输入得到同一结果，不加无依据随机数。 */
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seededPick(list, seed, count) {
    var arr = list.slice();
    var out = [];
    var s = seed >>> 0;
    while (out.length < count && arr.length) {
      s = (s * 1664525 + 1013904223) >>> 0;
      var idx = s % arr.length;
      out.push(arr[idx]);
      arr.splice(idx, 1);
    }
    return out;
  }

  function pinyinOf(char, choice) {
    var info = CHAR_INDEX[char];
    if (!info) return '';
    var opts = info.pinyin;
    if (opts.length === 1) return opts[0][0];
    var picked = choice && choice[char];
    if (picked) {
      var found = opts.filter(function (o) { return o[0] === picked; })[0];
      if (found) return found[0];
    }
    return null; /* 多音字未确认，返回 null 由 UI 强制确认 */
  }

  /* 书写难度：按常见度与字数粗略提示，明确说明这是估计不是测量。 */
  function writingNote(chars) {
    var rare = chars.filter(function (c) { return (CHAR_INDEX[c] && CHAR_INDEX[c].common <= 2); });
    if (!rare.length) return '全部为常见字，一般人可直接正确书写。';
    return '包含较少见用字：' + rare.join('、') + '。这不是书写难度的测量，只是提示他人可能需要查一下写法。';
  }

  /* 出处：本轮不接入古籍检索，候选一律标注为"原创组合"。
   * 若提供了用户自述的来源，才按用户输入显示，不代为编造。 */
  function sourceNote(kind, userSource) {
    if (userSource && String(userSource).trim()) {
      return '来源：' + String(userSource).trim() + '（由使用者提供，本软件未代为核验）';
    }
    return '出处：原创组合（由常用字按输入条件组合而成）。本轮未接入古籍出处检索，因此不标注古籍引文；' +
      '如需引用出处，请自行填写并核对。';
  }

  function homophoneNote(full) {
    var notes = [];
    Object.keys(HOMOPHONE_RISK).forEach(function (c) {
      if (full.indexOf(c) >= 0) notes.push(c + '：' + HOMOPHONE_RISK[c]);
    });
    if (!notes.length) return '未发现已知的常见误读风险（仅覆盖本模块内置的高频字，不等于全部风险）。';
    return notes.join(' ');
  }

  /* 常用程度资料范围 */
  function rarityNote(chars) {
    var scores = chars.filter(Boolean).map(function (c) { return CHAR_INDEX[c] ? CHAR_INDEX[c].common : 3; });
    if (!scores.length) return '未判断。';
    var avg = scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
    var level;
    if (avg >= 4.3) level = '在常见姓名用字范围内';
    else if (avg >= 3.4) level = '介于常见与中性之间';
    else if (avg >= 2.6) level = '偏少见，需要对方确认读法';
    else level = '明显少见，使用前建议确认他人能否读对';
    return '常用程度：' + level + '（基于本模块内置的 1–5 级用字频次估计，属于资料范围说明，不是查证结果）。';
  }

  /* 为什么符合输入：必须逐条对应用户实际填的条件。 */
  function matchReasons(norm, candidateChars, extra) {
    var reasons = [];
    if (norm.kind === 'person') {
      reasons.push('姓氏为「' + norm.surname + '」，名 ' + norm.givenLength + ' 字，合计 ' +
        (norm.surname.length + norm.givenLength) + ' 字（按你的字数要求）');
      if (norm.imagery.length) {
        var rep = matchReport(norm, candidateChars);
        if (rep.hitImagery.length) {
          reasons.push('用字命中你填写的意象：' + rep.hitImagery.join('、'));
        }
        if (rep.missImagery.length) {
          reasons.push('注意：这组用字没有命中你填写的意象「' + rep.missImagery.join('、') +
            '」，属于当前字库下的折中结果，不是完全符合');
        }
      }
      if (norm.style) {
        var st = null;
        STYLES.forEach(function (s) { if (s.key === norm.style) st = s; });
        if (st) {
          var rep2 = matchReport(norm, candidateChars);
          reasons.push('风格选择「' + st.label + '」：' + st.note +
            (rep2.styleHit ? '（本组用字符合该风格取向）' : '（本组用字未直接命中该风格的取向，仅作参考）'));
        }
      }
      if (norm.rarity === 'rare') reasons.push('按你的要求避开了高频用字');
      if (norm.rarity === 'plain') reasons.push('按你的要求优先使用易读的高频字');
      if (norm.forbidden) reasons.push('已排除你填写的禁用字「' + norm.forbidden + '」');
      if (norm.taboo && norm.taboo.length) reasons.push('已排除你填写的避讳字「' + norm.taboo.join('') + '」');
    } else {
      reasons.push('行业：' + (extra.industryLabel || '未选择') + '；' + (extra.industryNote || ''));
      if (norm.audience) reasons.push('目标客户：' + norm.audience + '，用词避免生僻与晦涩');
      if (norm.region) reasons.push('地域：' + norm.region + '，用字在该地区读音无歧义');
      if (norm.tone) reasons.push('气质要求：' + norm.tone);
      if (norm.forbidden) reasons.push('已排除禁用词「' + norm.forbidden + '」');
      reasons.push('长度为 ' + candidateChars.length + ' 字，符合你设定的 ' + norm.length + ' 字要求');
    }
    return reasons;
  }

  function generatePerson(norm) {
    var pool = poolFor(norm);
    if (!pool.length) {
      throw new Error('按当前条件没有可用用字。请放宽意象、风格或常用程度要求，或减少禁用字。');
    }
    var seed = hashString(norm.surname + '|' + norm.givenLength + '|' + norm.imagery.join(',') +
      '|' + norm.style + '|' + norm.rarity + '|' + norm.forbidden + '|' + (norm.taboo || []).join(''));
    /* pool 已按符合度降序排列（禁用/避讳硬过滤，其余软评分 + 稳定同分排序），
     * 因此直接取前段：最符合条件的排在最前，且同一输入始终得到同一结果。
     * 不做随机洗牌，避免把符合度顺序打乱后让最差结果排在最前。 */
    var picked = pool.slice(0, Math.min(pool.length, norm.givenLength * 14 + 14));
    /* 候选需要足够多才便于对比：从池中按确定性顺序取相邻组合 */
    var target = Math.max(1, Math.min(8, Math.floor((picked.length - norm.givenLength) / 1) || 0));
    if (target < 1) target = 1;
    /* 抽取不重复的名组合：每组用字不完全相同 */
    var candidates = [];
    var usedNames = Object.create(null);
    var tries = 0;
    while (candidates.length < 8 && tries < 60) {
      var offset = (tries * norm.givenLength) % Math.max(1, picked.length - norm.givenLength + 1);
      var chars = picked.slice(offset, offset + norm.givenLength);
      tries += 1;
      if (chars.length < norm.givenLength) break;
      var nameKey = chars.join('');
      if (usedNames[nameKey]) continue;
      usedNames[nameKey] = true;
      var needConfirm = [];
      chars.forEach(function (c) {
        if (pinyinOf(c, norm.pinyinChoice) === null) needConfirm.push(c);
      });
      candidates.push({
        id: 'p' + candidates.length,
        kind: 'person',
        given: nameKey,
        full: norm.surname + nameKey,
        chars: chars,
        surname: norm.surname,
        pinyin: null,
        needConfirm: needConfirm,
        rarity: rarityNote(chars),
        writing: writingNote(chars),
        homophone: homophoneNote(norm.surname + nameKey),
        reasons: matchReasons(norm, chars, {}),
        source: sourceNote('person')
      });
    }
    if (!candidates.length) {
      throw new Error('可用用字不足以组合出 ' + norm.givenLength + ' 字的名字，请放宽条件。');
    }
    return candidates;
  }

  /* 公司与品牌用同样的软评分思路：禁用词硬过滤，行业/气质/品类软加权。 */
  function poolForBiz(norm, toneTags) {
    var forbidden = norm.forbidden || '';
    var scored = UNIQUE_CHARS.filter(function (x) {
      if (forbidden.indexOf(x.c) >= 0) return false;
      return true;
    }).map(function (x) {
      var score = x.common; /* 默认可读性优先 */
      (toneTags || []).forEach(function (t) {
        if (x.imagery.indexOf(t) >= 0) score += 5;
        else if (t === x.meaning) score += 4;
      });
      return { c: x.c, score: score };
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.c < b.c ? -1 : (a.c > b.c ? 1 : 0);
    });
    return scored.map(function (x) { return x.c; });
  }

  function generateCompany(norm) {
    var ind = null;
    INDUSTRIES.forEach(function (x) { if (x.key === norm.industry) ind = x; });
    var toneTags = ind ? ind.tone.slice() : [];
    if (norm.tone) toneTags.push(norm.tone);
    var pool = poolForBiz(norm, toneTags);
    if (!pool.length) throw new Error('按当前条件没有可用用字，请放宽气质要求或减少禁用词。');
    var seed = hashString('c|' + norm.industry + '|' + norm.region + '|' + norm.audience + '|' + norm.tone + '|' + norm.length);
    var target = Math.max(2, Math.min(6, norm.length));
    var picked = pool.slice(0, Math.min(pool.length, target * 12 + 12));
    var candidates = [];
    var usedNames = Object.create(null);
    var tries = 0;
    while (candidates.length < 8 && tries < 60) {
      var offset = (tries * target) % Math.max(1, picked.length - target + 1);
      var chars = picked.slice(offset, offset + target);
      tries += 1;
      if (chars.length < target) break;
      var brand = chars.join('');
      if (usedNames[brand]) continue;
      usedNames[brand] = true;
      candidates.push({
        id: 'c' + candidates.length,
        kind: 'company',
        brand: brand,
        chars: chars,
        displayName: brand,
        legalName: norm.legalName || '（未填写法定企业名称）',
        legalNote: norm.legalName
          ? '法定企业名称结构与品牌展示名分开处理：法定名称按你填写的「' + norm.legalName + '」使用，品牌展示名为「' + brand + '」。两者用途不同，不应互相替代。'
          : '尚未填写法定企业名称。品牌展示名不等于工商登记名称，注册时需另行核验。',
        rarity: rarityNote(chars),
        writing: writingNote(chars),
        homophone: homophoneNote(brand),
        reasons: matchReasons(norm, chars, {
          industryLabel: ind ? ind.label : '未选择',
          industryNote: ind ? ind.note : ''
        }),
        source: sourceNote('company'),
        trademark: '尚未核验：本轮未接入商标与工商重名查询，不能保证可注册，也不能保证不与他人在先权利冲突。'
      });
    }
    if (!candidates.length) throw new Error('可用用字不足以组合 ' + target + ' 字名称，请放宽条件。');
    return candidates;
  }

  function generateBrand(norm) {
    var pool = poolForBiz(norm, norm.tone ? [norm.tone] : []);
    if (!pool.length) throw new Error('按当前条件没有可用用字，请减少禁用词。');
    var seed = hashString('b|' + norm.category + '|' + norm.tone + '|' + norm.length);
    var target = Math.max(2, Math.min(5, norm.length));
    var picked = pool.slice(0, Math.min(pool.length, target * 12 + 12));
    var candidates = [];
    var usedNames = Object.create(null);
    var tries = 0;
    while (candidates.length < 8 && tries < 60) {
      var offset = (tries * target) % Math.max(1, picked.length - target + 1);
      var chars = picked.slice(offset, offset + target);
      tries += 1;
      if (chars.length < target) break;
      var nm = chars.join('');
      if (usedNames[nm]) continue;
      usedNames[nm] = true;
      candidates.push({
        id: 'b' + candidates.length,
        kind: 'brand',
        name: nm,
        chars: chars,
        category: norm.category || '未指定品类',
        rarity: rarityNote(chars),
        writing: writingNote(chars),
        homophone: homophoneNote(nm),
        reasons: matchReasons(norm, chars, {}),
        source: sourceNote('brand'),
        trademark: '尚未核验：未接入商标查询，不能保证可注册。'
      });
    }
    if (!candidates.length) throw new Error('可用用字不足以组合 ' + target + ' 字品牌名，请放宽条件。');
    return candidates;
  }

  function calculate(norm) {
    var candidates;
    if (norm.kind === 'person') {
      if (!norm.surname) throw new Error('请填写姓氏');
      if (SURNAMES.indexOf(norm.surname) < 0) {
        /* 不在常见姓氏表内不阻断，但如实提示 */
      }
      if (!norm.birthProvided) {
        /* 缺时辰不强算喜忌：本轮不输出任何喜用神结论 */
      }
      candidates = generatePerson(norm);
    } else if (norm.kind === 'company') {
      candidates = generateCompany(norm);
    } else {
      candidates = generateBrand(norm);
    }

    var focus, basis, blocker, first, confirm;
    if (norm.kind === 'person') {
      focus = '你为姓氏「' + norm.surname + '」生成 ' + norm.givenLength + ' 字的名，共 ' +
        candidates.length + ' 个候选。';
      basis = '候选由以下实际条件筛出：姓氏 ' + norm.surname + '；名 ' + norm.givenLength + ' 字' +
        (norm.imagery.length ? '；意象 ' + norm.imagery.join('、') : '') +
        (norm.style ? '；风格 ' + norm.style : '') +
        (norm.rarity !== 'any' ? '；常见程度 ' + norm.rarity : '') +
        (norm.forbidden ? '；禁用字 ' + norm.forbidden : '') +
        (norm.taboo && norm.taboo.length ? '；避讳 ' + norm.taboo.join('') : '') + '。';
      blocker = norm.birthProvided
        ? '本模块不输出喜用神、命理吉凶或五行补益结论。即使填写了出生资料，起名效果也不由八字决定；' +
          '缺时辰时更不会替你假定一个时辰来补算。'
        : '你没有填写出生资料，本模块因此完全不涉及命理判断。若之后想结合生辰，需另行说明采用哪一套体系并核对历法与真太阳时，不能默认套用。';
      first = '先从候选里挑出你愿意用一辈子的 2–3 个，再去看读音和书写，不要只看字面。';
      confirm = '商标与工商重名尚未核验；出处在本轮统一标注为原创组合，未接入古籍检索；' +
        '若候选中含多音字，需要你确认读音后才会写入正式结果。';
    } else if (norm.kind === 'company') {
      focus = '你为「' + (norm.industry || '未指定行业') + '」生成品牌展示名候选，' +
        '法定企业名称与展示名分开处理。';
      basis = '候选按行业 ' + (norm.industry || '未选') + '；地域 ' + (norm.region || '未选') +
        '；客户 ' + (norm.audience || '未填') + '；气质 ' + (norm.tone || '未填') +
        '；长度 ' + norm.length + ' 字' + (norm.forbidden ? '；禁用词 ' + norm.forbidden : '') + ' 筛出。';
      blocker = '品牌展示名不等于工商登记名称，也不等于商标。本轮两者都没有查询能力，任何"这个名字一定能注册"的说法都不成立。';
      first = '先确定法定企业名称的可用性，再回头定品牌展示名；顺序反了会返工。';
      confirm = '工商与商标：尚未核验。行业地域的读音差异需要使用者自行确认。';
    } else {
      focus = '你为「' + (norm.category || '未指定品类') + '」生成品牌名候选。';
      basis = '候选按品类 ' + (norm.category || '未选') + '；气质 ' + (norm.tone || '未填') +
        '；长度 ' + norm.length + ' 字' + (norm.forbidden ? '；禁用词 ' + norm.forbidden : '') + ' 筛出。';
      blocker = '品牌名的可用性依赖商标与域名等外部条件，本轮没有查询能力，候选仅供创意比较。';
      first = '把候选放到实际使用场景里看：图标缩小后还能认出来吗？口头念出来别人会不会听错？';
      confirm = '商标：尚未核验。域名与社交账号是否可用需自行确认。';
    }

    return {
      resultId: Reg.newResultId('naming'),
      moduleId: 'naming',
      createdAt: new Date().toISOString(),
      inputSnapshot: Reg.buildSnapshot(norm, norm.kind === 'person' && !norm.birthProvided ? ['未提供出生资料，不做命理判断'] : []),
      normalizedInputs: norm,
      method: '按用户实际填写的条件（姓氏、字数、意象、风格、禁用字、避讳、常见程度）确定性筛选用字并组合。' +
        '同一组输入始终得到同一批候选，不引入随机数。',
      algorithmVersion: 'naming-1.0.0',
      evidence: candidates.map(function (c) {
        return {
          id: c.id,
          label: c.full || c.brand || c.name,
          reasons: c.reasons,
          rarity: c.rarity,
          writing: c.writing,
          homophone: c.homophone,
          source: c.source,
          needConfirm: c.needConfirm
        };
      }),
      interpretations: Reg.buildInterpretations({
        focus: focus, basis: basis, blocker: blocker, first: first, confirm: confirm
      }),
      actions: [
        { at: '第一步', text: '在候选中勾选最多 4 个进入对比' },
        { at: '第二步', text: '点击候选查看读音、含义、出处标注、谐音与书写难度' },
        { at: '第三步', text: '在名片、图标、招牌、签名、印章中试名' },
        { at: '第四步', text: '收藏保留，标记排除不再出现' }
      ],
      limitations: [
        '本模块不做命理吉凶打分，不输出喜用神结论，也不保证名字带来任何实际结果。',
        '商标与工商重名尚未核验，不能保证可注册。',
        '常用程度与书写难度是基于内置字频的估计，不是查证结果。',
        '笔画与五格属文化选项，本轮未接入数据源，因此不显示相关结论。',
        '出处统一标注为原创组合，不编造古籍引文、诗句或作者。'
      ],
      assets: [],
      randomRecord: null,
      candidates: candidates,
      strokePolicy: STROKE_POLICY
    };
  }

  /* ------------------------------------------------------------ 收藏 / 排除 / 对比 */

  var FAV_KEY = 'naming_favorites';
  var EXCLUDE_KEY = 'naming_excluded';

  function loadList(key) { return Reg.store.read(key, []) || []; }
  function saveList(key, list) { Reg.store.write(key, list); return list; }

  function favorites() { return loadList(FAV_KEY); }
  function toggleFavorite(cand) {
    var list = favorites();
    var id = cand.id;
    var i = -1;
    list.forEach(function (x, idx) { if (x.id === id) i = idx; });
    if (i >= 0) { list.splice(i, 1); }
    else {
      list.unshift({
        id: cand.id, kind: cand.kind, label: cand.full || cand.brand || cand.name,
        chars: cand.chars, reasons: cand.reasons, source: cand.source,
        homophone: cand.homophone, rarity: cand.rarity, at: new Date().toISOString()
      });
    }
    return saveList(FAV_KEY, list);
  }

  function excluded() { return loadList(EXCLUDE_KEY); }
  function toggleExclude(cand) {
    var list = excluded();
    var id = cand.id;
    var i = -1;
    list.forEach(function (x, idx) { if (x.id === id) i = idx; });
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ id: id, at: new Date().toISOString() });
    return saveList(EXCLUDE_KEY, list);
  }

  function compare(ids) {
    if (!Array.isArray(ids)) throw new Error('对比需要候选编号数组');
    if (ids.length > 4) throw new Error('对比最多 4 个候选');
    var all = (Reg.store.read('naming_last', []) || []);
    return ids.map(function (id) {
      return all.filter(function (c) { return c.id === id; })[0] || null;
    });
  }

  function saveLast(candidates) { Reg.store.write('naming_last', candidates); }

  /* ------------------------------------------------------------ 模块 */

  Reg.register({
    id: 'naming',
    title: '起名工坊',
    version: 'naming-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [
        { name: 'kind', label: '名字类型', type: 'string', required: true }
      ]
    },
    capabilities: [
      '人名 / 公司名 / 品牌名三类分开处理，不混成吉凶打分',
      '姓氏、字数、意象、风格、禁用字、避讳、常见程度条件实际生效',
      '同一输入结果稳定（确定性生成，不加无依据随机）',
      '多音字强制确认读音',
      '候选对比最多 4 个，支持收藏与排除',
      '商标与工商显示"尚未核验"，不做注册保证',
      '笔画与五格单列为未接入项，不冒充已实现'
    ],
    normalize: normalize,
    calculate: calculate
  });

  global.NamingModule = {
    CHARS: UNIQUE_CHARS,
    CHAR_INDEX: CHAR_INDEX,
    SURNAMES: SURNAMES,
    IMAGERY_TAGS: IMAGERY_TAGS,
    STYLES: STYLES,
    INDUSTRIES: INDUSTRIES,
    REGIONS: REGIONS,
    HOMOPHONE_RISK: HOMOPHONE_RISK,
    STROKE_POLICY: STROKE_POLICY,
    calculate: calculate,
    normalize: normalize,
    pinyinOf: pinyinOf,
    favorites: favorites,
    toggleFavorite: toggleFavorite,
    excluded: excluded,
    toggleExclude: toggleExclude,
    compare: compare,
    saveLast: saveLast
  };
})(window);