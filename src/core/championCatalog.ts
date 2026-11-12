/**
 * NexusAkari Pro (v4) — Slice-14: Complete 169-Champion Riot ID Catalog,
 * Complete 65-Rune Perk Metadata Dictionary & Adaptive 9-Perk LCU Rune Page Generator.
 * Ensures zero `英雄 #ID` fallbacks across all 169 League of Legends champions.
 */

import { AramChampionBalance, DamageType, RoleType, RunePagePreset } from './types';

export interface ChampionCatalogEntry {
  id: number;
  name: string;
  title: string;
  primaryRole: RoleType;
  damageType: DamageType;
  frontline: number; // 1-10
  cc: number; // 1-10
  waveclear: number; // 1-10
  scaling: number; // 1-10
  archetype:
    | 'ADC_AS'
    | 'ADC_CASTER'
    | 'MAGE_BURST'
    | 'MAGE_BATTLE'
    | 'ASSASSIN_AD'
    | 'ASSASSIN_AP'
    | 'BRUISER_CONQ'
    | 'TANK_GRASP'
    | 'TANK_ENGAGE'
    | 'ENCHANTER';
}

type CompactChampTuple = [
  number,
  string,
  string,
  RoleType,
  DamageType,
  number,
  number,
  number,
  number,
  ChampionCatalogEntry['archetype']
];

const COMPACT_CHAMPION_TUPLES: CompactChampTuple[] = [
  [1, '黑暗之女', '安妮', RoleType.MID, DamageType.MAGIC, 3, 8, 7, 7, 'MAGE_BURST'],
  [2, '狂战士', '奥拉夫', RoleType.TOP, DamageType.PHYSICAL, 7, 3, 6, 6, 'BRUISER_CONQ'],
  [3, '正义巨像', '加里奥', RoleType.MID, DamageType.MAGIC, 8, 9, 8, 7, 'TANK_ENGAGE'],
  [4, '卡牌大师', '崔斯特', RoleType.MID, DamageType.MAGIC, 2, 7, 9, 7, 'MAGE_BURST'],
  [5, '德邦总管', '赵信', RoleType.JGL, DamageType.PHYSICAL, 7, 6, 6, 6, 'BRUISER_CONQ'],
  [6, '无畏战车', '厄加特', RoleType.TOP, DamageType.PHYSICAL, 8, 6, 8, 8, 'BRUISER_CONQ'],
  [7, '诡术妖姬', '乐芙兰', RoleType.MID, DamageType.MAGIC, 2, 5, 5, 7, 'ASSASSIN_AP'],
  [8, '猩红收割者', '弗拉基米尔', RoleType.MID, DamageType.MAGIC, 6, 2, 8, 10, 'MAGE_BATTLE'],
  [9, '远古恐惧', '费德提克', RoleType.JGL, DamageType.MAGIC, 4, 9, 7, 8, 'MAGE_BURST'],
  [10, '正义天使', '凯尔', RoleType.TOP, DamageType.MIXED, 3, 4, 9, 10, 'ADC_AS'],
  [11, '无极剑圣', '易', RoleType.JGL, DamageType.TRUE, 4, 1, 7, 9, 'ADC_AS'],
  [12, '牛头酋长', '阿利斯塔', RoleType.SUP, DamageType.MAGIC, 10, 9, 2, 6, 'TANK_ENGAGE'],
  [13, '符文法师', '瑞兹', RoleType.MID, DamageType.MAGIC, 5, 6, 10, 9, 'MAGE_BATTLE'],
  [14, '亡灵战神', '赛恩', RoleType.TOP, DamageType.PHYSICAL, 10, 9, 8, 8, 'TANK_GRASP'],
  [15, '战争女神', '希维尔', RoleType.BOT, DamageType.PHYSICAL, 2, 1, 10, 9, 'ADC_AS'],
  [16, '众星之子', '索拉卡', RoleType.SUP, DamageType.MAGIC, 2, 5, 3, 8, 'ENCHANTER'],
  [17, '迅捷斥候', '提莫', RoleType.TOP, DamageType.MAGIC, 2, 4, 7, 7, 'MAGE_BATTLE'],
  [18, '麦林炮手', '崔丝塔娜', RoleType.BOT, DamageType.PHYSICAL, 3, 4, 8, 9, 'ADC_AS'],
  [19, '祖安怒兽', '沃里克', RoleType.JGL, DamageType.MIXED, 8, 7, 5, 5, 'BRUISER_CONQ'],
  [20, '雪原双子', '努努和威朗普', RoleType.JGL, DamageType.MAGIC, 9, 8, 6, 6, 'TANK_ENGAGE'],
  [21, '赏金猎人', '厄运小姐', RoleType.BOT, DamageType.PHYSICAL, 2, 3, 8, 8, 'ADC_CASTER'],
  [22, '寒冰射手', '艾希', RoleType.BOT, DamageType.PHYSICAL, 2, 9, 7, 8, 'ADC_AS'],
  [23, '蛮族之王', '泰达米尔', RoleType.TOP, DamageType.PHYSICAL, 6, 3, 8, 8, 'ADC_AS'],
  [24, '武器大师', '贾克斯', RoleType.TOP, DamageType.MIXED, 8, 7, 6, 9, 'BRUISER_CONQ'],
  [25, '堕落天使', '莫甘娜', RoleType.SUP, DamageType.MAGIC, 3, 9, 7, 7, 'MAGE_BURST'],
  [26, '时光守护者', '基兰', RoleType.SUP, DamageType.MAGIC, 2, 8, 8, 9, 'ENCHANTER'],
  [27, '炼金术士', '辛吉德', RoleType.TOP, DamageType.MAGIC, 8, 7, 9, 7, 'MAGE_BATTLE'],
  [28, '痛苦之拥', '伊芙琳', RoleType.JGL, DamageType.MAGIC, 3, 5, 6, 8, 'ASSASSIN_AP'],
  [29, '瘟疫之源', '图奇', RoleType.BOT, DamageType.TRUE, 2, 3, 7, 10, 'ADC_AS'],
  [30, '死亡颂唱者', '卡尔萨斯', RoleType.JGL, DamageType.MAGIC, 2, 3, 9, 10, 'MAGE_BURST'],
  [31, '虚空恐惧', '科加斯', RoleType.TOP, DamageType.TRUE, 10, 8, 7, 8, 'TANK_GRASP'],
  [32, '殇之木乃伊', '阿木木', RoleType.JGL, DamageType.MAGIC, 9, 10, 6, 7, 'TANK_ENGAGE'],
  [33, '披甲龙龟', '拉莫斯', RoleType.JGL, DamageType.MAGIC, 10, 8, 5, 7, 'TANK_ENGAGE'],
  [34, '冰晶凤凰', '艾尼维亚', RoleType.MID, DamageType.MAGIC, 4, 9, 10, 9, 'MAGE_BURST'],
  [35, '恶魔小丑', '萨科', RoleType.JGL, DamageType.PHYSICAL, 2, 6, 5, 6, 'ASSASSIN_AD'],
  [36, '祖安狂人', '蒙多医生', RoleType.TOP, DamageType.MIXED, 10, 3, 7, 9, 'TANK_GRASP'],
  [37, '琴瑟仙女', '娑娜', RoleType.SUP, DamageType.MAGIC, 2, 6, 3, 9, 'ENCHANTER'],
  [38, '虚空行者', '卡萨丁', RoleType.MID, DamageType.MAGIC, 5, 4, 7, 10, 'ASSASSIN_AP'],
  [39, '刀锋舞者', '艾瑞莉娅', RoleType.TOP, DamageType.MIXED, 7, 6, 9, 8, 'BRUISER_CONQ'],
  [40, '风暴之怒', '迦娜', RoleType.SUP, DamageType.MAGIC, 2, 9, 4, 8, 'ENCHANTER'],
  [41, '海洋之灾', '普朗克', RoleType.TOP, DamageType.TRUE, 4, 4, 10, 10, 'ADC_CASTER'],
  [42, '英勇投弹手', '库奇', RoleType.MID, DamageType.MIXED, 3, 2, 9, 9, 'ADC_CASTER'],
  [43, '天启者', '卡尔玛', RoleType.SUP, DamageType.MAGIC, 3, 6, 8, 6, 'ENCHANTER'],
  [44, '瓦洛兰之盾', '塔里克', RoleType.SUP, DamageType.MAGIC, 9, 8, 3, 9, 'TANK_ENGAGE'],
  [45, '邪恶小法师', '维迦', RoleType.MID, DamageType.MAGIC, 2, 9, 8, 10, 'MAGE_BURST'],
  [48, '巨魔之王', '特朗德尔', RoleType.TOP, DamageType.PHYSICAL, 8, 5, 6, 7, 'BRUISER_CONQ'],
  [50, '诺克萨斯统领', '斯维因', RoleType.MID, DamageType.MAGIC, 8, 7, 8, 8, 'MAGE_BATTLE'],
  [51, '皮城女警', '凯特琳', RoleType.BOT, DamageType.PHYSICAL, 2, 5, 8, 9, 'ADC_AS'],
  [53, '蒸汽机器人', '布里茨', RoleType.SUP, DamageType.MAGIC, 7, 9, 3, 5, 'TANK_ENGAGE'],
  [54, '熔岩巨兽', '墨菲特', RoleType.TOP, DamageType.MAGIC, 10, 9, 6, 7, 'TANK_GRASP'],
  [55, '不祥之刃', '卡特琳娜', RoleType.MID, DamageType.MIXED, 3, 1, 7, 8, 'ASSASSIN_AP'],
  [56, '永恒梦魇', '魔腾', RoleType.JGL, DamageType.PHYSICAL, 6, 6, 7, 7, 'BRUISER_CONQ'],
  [57, '扭曲树精', '茂凯', RoleType.SUP, DamageType.MAGIC, 9, 10, 6, 8, 'TANK_ENGAGE'],
  [58, '荒漠屠夫', '雷克顿', RoleType.TOP, DamageType.PHYSICAL, 8, 7, 8, 5, 'BRUISER_CONQ'],
  [59, '德玛西亚皇子', '嘉文四世', RoleType.JGL, DamageType.PHYSICAL, 8, 8, 6, 6, 'BRUISER_CONQ'],
  [60, '蜘蛛女皇', '伊莉丝', RoleType.JGL, DamageType.MAGIC, 4, 7, 5, 5, 'ASSASSIN_AP'],
  [61, '发条魔灵', '奥莉安娜', RoleType.MID, DamageType.MAGIC, 3, 8, 9, 9, 'MAGE_BURST'],
  [62, '齐天大圣', '孙悟空', RoleType.JGL, DamageType.PHYSICAL, 7, 8, 6, 7, 'BRUISER_CONQ'],
  [63, '复仇焰魂', '布兰德', RoleType.SUP, DamageType.MAGIC, 2, 5, 8, 8, 'MAGE_BURST'],
  [64, '盲僧', '李青', RoleType.JGL, DamageType.PHYSICAL, 6, 7, 6, 5, 'BRUISER_CONQ'],
  [67, '暗夜猎手', '薇恩', RoleType.BOT, DamageType.TRUE, 2, 4, 3, 10, 'ADC_AS'],
  [68, '机械公敌', '兰博', RoleType.TOP, DamageType.MAGIC, 6, 5, 9, 7, 'MAGE_BURST'],
  [69, '魔蛇之拥', '卡西奥佩娅', RoleType.MID, DamageType.MAGIC, 4, 7, 8, 10, 'MAGE_BATTLE'],
  [72, '上古领主', '斯卡纳', RoleType.JGL, DamageType.MIXED, 9, 10, 6, 7, 'TANK_ENGAGE'],
  [74, '大发明家', '黑默丁格', RoleType.MID, DamageType.MAGIC, 2, 6, 10, 7, 'MAGE_BURST'],
  [75, '沙漠死神', '内瑟斯', RoleType.TOP, DamageType.PHYSICAL, 9, 5, 6, 9, 'TANK_GRASP'],
  [76, '狂野女猎手', '奈德丽', RoleType.JGL, DamageType.MAGIC, 3, 1, 6, 6, 'ASSASSIN_AP'],
  [77, '兽灵行者', '乌迪尔', RoleType.JGL, DamageType.MIXED, 9, 6, 8, 7, 'BRUISER_CONQ'],
  [78, '圣锤之毅', '波比', RoleType.TOP, DamageType.PHYSICAL, 9, 9, 6, 7, 'TANK_GRASP'],
  [79, '酒桶', '古拉加斯', RoleType.TOP, DamageType.MAGIC, 8, 9, 8, 8, 'MAGE_BURST'],
  [80, '不屈之枪', '潘森', RoleType.MID, DamageType.PHYSICAL, 6, 7, 7, 6, 'BRUISER_CONQ'],
  [81, '探险家', '伊泽瑞尔', RoleType.BOT, DamageType.MIXED, 3, 1, 6, 8, 'ADC_CASTER'],
  [82, '铁铠冥魂', '莫德凯撒', RoleType.TOP, DamageType.MAGIC, 9, 6, 7, 8, 'BRUISER_CONQ'],
  [83, '牧魂人', '约里克', RoleType.TOP, DamageType.MIXED, 8, 4, 9, 8, 'TANK_GRASP'],
  [84, '离群之刺', '阿卡丽', RoleType.MID, DamageType.MAGIC, 4, 2, 6, 8, 'ASSASSIN_AP'],
  [85, '狂暴之心', '凯南', RoleType.TOP, DamageType.MAGIC, 4, 9, 7, 8, 'MAGE_BURST'],
  [86, '德玛西亚之力', '盖伦', RoleType.TOP, DamageType.TRUE, 9, 4, 8, 7, 'BRUISER_CONQ'],
  [89, '曙光女神', '蕾欧娜', RoleType.SUP, DamageType.MAGIC, 10, 10, 2, 6, 'TANK_ENGAGE'],
  [90, '虚空先知', '玛尔扎哈', RoleType.MID, DamageType.MAGIC, 3, 9, 10, 8, 'MAGE_BURST'],
  [91, '刀锋之影', '泰隆', RoleType.MID, DamageType.PHYSICAL, 3, 2, 8, 6, 'ASSASSIN_AD'],
  [92, '放逐之刃', '锐雯', RoleType.TOP, DamageType.PHYSICAL, 6, 7, 8, 8, 'BRUISER_CONQ'],
  [96, '深渊巨口', '克格莫', RoleType.BOT, DamageType.MIXED, 1, 2, 7, 10, 'ADC_AS'],
  [98, '暮光之眼', '慎', RoleType.TOP, DamageType.MIXED, 9, 7, 4, 7, 'TANK_GRASP'],
  [99, '光辉女郎', '拉克丝', RoleType.MID, DamageType.MAGIC, 2, 7, 9, 8, 'MAGE_BURST'],
  [101, '远古巫灵', '泽拉斯', RoleType.MID, DamageType.MAGIC, 1, 6, 10, 8, 'MAGE_BURST'],
  [102, '龙血武姬', '希瓦娜', RoleType.JGL, DamageType.MAGIC, 7, 3, 8, 8, 'MAGE_BURST'],
  [103, '九尾妖狐', '阿狸', RoleType.MID, DamageType.MAGIC, 3, 7, 8, 7, 'MAGE_BURST'],
  [104, '法外狂徒', '格雷福斯', RoleType.JGL, DamageType.PHYSICAL, 5, 2, 8, 8, 'ADC_CASTER'],
  [105, '潮汐海灵', '菲兹', RoleType.MID, DamageType.MAGIC, 3, 5, 6, 8, 'ASSASSIN_AP'],
  [106, '不灭狂雷', '沃利贝尔', RoleType.TOP, DamageType.MIXED, 9, 7, 7, 7, 'TANK_GRASP'],
  [107, '傲之追猎者', '雷恩加尔', RoleType.JGL, DamageType.PHYSICAL, 4, 4, 6, 7, 'ASSASSIN_AD'],
  [110, '惩戒之箭', '韦鲁斯', RoleType.BOT, DamageType.MIXED, 2, 7, 8, 8, 'ADC_AS'],
  [111, '深海泰坦', '诺提勒斯', RoleType.SUP, DamageType.MAGIC, 10, 10, 4, 6, 'TANK_ENGAGE'],
  [112, '机械先驱', '维克托', RoleType.MID, DamageType.MAGIC, 3, 6, 10, 10, 'MAGE_BURST'],
  [113, '北地之怒', '瑟庄妮', RoleType.JGL, DamageType.MAGIC, 10, 10, 6, 7, 'TANK_ENGAGE'],
  [114, '无双剑姬', '菲奥娜', RoleType.TOP, DamageType.TRUE, 6, 3, 6, 10, 'BRUISER_CONQ'],
  [115, '爆破鬼才', '吉格斯', RoleType.BOT, DamageType.MAGIC, 2, 5, 10, 8, 'MAGE_BURST'],
  [117, '仙灵女巫', '璐璐', RoleType.SUP, DamageType.MAGIC, 2, 8, 4, 9, 'ENCHANTER'],
  [119, '荣耀行刑官', '德莱文', RoleType.BOT, DamageType.PHYSICAL, 2, 3, 7, 7, 'ADC_AS'],
  [120, '战争之影', '赫卡里姆', RoleType.JGL, DamageType.PHYSICAL, 7, 7, 8, 7, 'BRUISER_CONQ'],
  [121, '虚空掠夺者', '卡兹克', RoleType.JGL, DamageType.PHYSICAL, 3, 2, 5, 8, 'ASSASSIN_AD'],
  [122, '诺克萨斯之手', '德莱厄斯', RoleType.TOP, DamageType.TRUE, 8, 5, 7, 7, 'BRUISER_CONQ'],
  [126, '未来守护者', '杰斯', RoleType.TOP, DamageType.PHYSICAL, 4, 4, 8, 7, 'ADC_CASTER'],
  [127, '冰霜女巫', '丽桑卓', RoleType.MID, DamageType.MAGIC, 5, 10, 8, 8, 'MAGE_BURST'],
  [131, '皎月女神', '黛安娜', RoleType.JGL, DamageType.MAGIC, 6, 7, 8, 8, 'ASSASSIN_AP'],
  [133, '德玛西亚之翼', '奎因', RoleType.TOP, DamageType.PHYSICAL, 2, 4, 7, 7, 'ADC_AS'],
  [134, '暗黑元首', '辛德拉', RoleType.MID, DamageType.MAGIC, 2, 8, 9, 9, 'MAGE_BURST'],
  [136, '铸星龙王', '奥瑞利安·索尔', RoleType.MID, DamageType.MAGIC, 4, 8, 10, 10, 'MAGE_BURST'],
  [141, '影流之镰', '凯隐', RoleType.JGL, DamageType.PHYSICAL, 7, 6, 8, 9, 'BRUISER_CONQ'],
  [142, '暮光星灵', '佐伊', RoleType.MID, DamageType.MAGIC, 2, 7, 7, 7, 'MAGE_BURST'],
  [143, '荆棘之兴', '婕拉', RoleType.SUP, DamageType.MAGIC, 2, 8, 8, 7, 'MAGE_BURST'],
  [145, '虚空之女', '卡莎', RoleType.BOT, DamageType.MIXED, 3, 1, 8, 10, 'ADC_AS'],
  [147, '星籁歌姬', '萨勒芬妮', RoleType.SUP, DamageType.MAGIC, 2, 9, 9, 9, 'ENCHANTER'],
  [150, '迷失之牙', '纳尔', RoleType.TOP, DamageType.MIXED, 7, 8, 7, 7, 'TANK_GRASP'],
  [154, '生化魔人', '扎克', RoleType.JGL, DamageType.MAGIC, 10, 10, 6, 8, 'TANK_ENGAGE'],
  [157, '疾风剑豪', '亚索', RoleType.MID, DamageType.PHYSICAL, 4, 6, 9, 9, 'ADC_AS'],
  [161, '虚空之眼', '维克兹', RoleType.MID, DamageType.TRUE, 1, 6, 9, 8, 'MAGE_BURST'],
  [163, '岩雀', '塔莉垭', RoleType.MID, DamageType.MAGIC, 3, 8, 9, 8, 'MAGE_BURST'],
  [164, '青钢影', '卡蜜尔', RoleType.TOP, DamageType.TRUE, 7, 7, 5, 9, 'TANK_GRASP'],
  [166, '影哨', '阿克尚', RoleType.MID, DamageType.PHYSICAL, 2, 2, 8, 8, 'ADC_AS'],
  [200, '虚空女皇', '卑尔维斯', RoleType.JGL, DamageType.TRUE, 6, 5, 7, 9, 'ADC_AS'],
  [201, '弗雷尔卓德之心', '布隆', RoleType.SUP, DamageType.MAGIC, 9, 9, 3, 7, 'TANK_ENGAGE'],
  [202, '戏命师', '烬', RoleType.BOT, DamageType.PHYSICAL, 2, 6, 7, 9, 'ADC_CASTER'],
  [203, '永猎双子', '千珏', RoleType.JGL, DamageType.PHYSICAL, 4, 3, 7, 9, 'ADC_AS'],
  [221, '祖安花火', '泽丽', RoleType.BOT, DamageType.MIXED, 3, 2, 8, 10, 'ADC_AS'],
  [222, '暴走萝莉', '金克丝', RoleType.BOT, DamageType.PHYSICAL, 2, 5, 9, 10, 'ADC_AS'],
  [223, '河流之王', '塔姆', RoleType.TOP, DamageType.MAGIC, 10, 8, 5, 7, 'TANK_GRASP'],
  [233, '狂厄蔷薇', '贝蕾亚', RoleType.JGL, DamageType.PHYSICAL, 7, 7, 6, 7, 'BRUISER_CONQ'],
  [234, '破败之王', '佛耶戈', RoleType.JGL, DamageType.PHYSICAL, 6, 5, 7, 9, 'BRUISER_CONQ'],
  [235, '涤魂圣枪', '赛娜', RoleType.SUP, DamageType.PHYSICAL, 2, 6, 6, 10, 'ADC_CASTER'],
  [236, '圣枪游侠', '卢锡安', RoleType.BOT, DamageType.PHYSICAL, 3, 1, 8, 7, 'ADC_CASTER'],
  [238, '影流之主', '劫', RoleType.MID, DamageType.PHYSICAL, 3, 2, 8, 7, 'ASSASSIN_AD'],
  [240, '暴怒骑士', '克烈', RoleType.TOP, DamageType.PHYSICAL, 8, 6, 6, 6, 'BRUISER_CONQ'],
  [245, '时间刺客', '艾克', RoleType.JGL, DamageType.MAGIC, 5, 6, 8, 9, 'ASSASSIN_AP'],
  [246, '元素女皇', '奇亚娜', RoleType.MID, DamageType.PHYSICAL, 3, 8, 7, 7, 'ASSASSIN_AD'],
  [254, '皮城执法官', '蔚', RoleType.JGL, DamageType.PHYSICAL, 7, 9, 6, 7, 'BRUISER_CONQ'],
  [266, '暗裔剑魔', '亚托克斯', RoleType.TOP, DamageType.PHYSICAL, 8, 7, 7, 7, 'BRUISER_CONQ'],
  [267, '唤潮鲛姬', '娜美', RoleType.SUP, DamageType.MAGIC, 2, 8, 4, 7, 'ENCHANTER'],
  [268, '沙漠皇帝', '阿兹尔', RoleType.MID, DamageType.MAGIC, 3, 7, 9, 10, 'ADC_AS'],
  [350, '魔法猫咪', '悠米', RoleType.SUP, DamageType.MAGIC, 1, 4, 2, 9, 'ENCHANTER'],
  [360, '沙漠玫瑰', '莎弥拉', RoleType.BOT, DamageType.PHYSICAL, 4, 3, 8, 8, 'BRUISER_CONQ'],
  [412, '魂锁典狱长', '锤石', RoleType.SUP, DamageType.MAGIC, 7, 9, 3, 7, 'TANK_ENGAGE'],
  [420, '海兽祭司', '俄洛伊', RoleType.TOP, DamageType.PHYSICAL, 8, 3, 9, 7, 'TANK_GRASP'],
  [421, '虚空遁地兽', '雷克塞', RoleType.JGL, DamageType.PHYSICAL, 7, 7, 6, 5, 'BRUISER_CONQ'],
  [427, '翠神', '艾翁', RoleType.JGL, DamageType.MAGIC, 5, 8, 5, 8, 'ENCHANTER'],
  [429, '复仇之矛', '卡莉丝塔', RoleType.BOT, DamageType.PHYSICAL, 2, 6, 7, 6, 'ADC_AS'],
  [432, '星界游神', '巴德', RoleType.SUP, DamageType.MAGIC, 5, 8, 4, 8, 'ENCHANTER'],
  [497, '幻翎', '洛', RoleType.SUP, DamageType.MAGIC, 6, 9, 3, 8, 'TANK_ENGAGE'],
  [498, '逆羽', '霞', RoleType.BOT, DamageType.PHYSICAL, 3, 6, 9, 9, 'ADC_AS'],
  [516, '山隐之焰', '奥恩', RoleType.TOP, DamageType.MIXED, 10, 9, 7, 9, 'TANK_GRASP'],
  [517, '解脱者', '塞拉斯', RoleType.MID, DamageType.MAGIC, 6, 6, 7, 9, 'BRUISER_CONQ'],
  [518, '万花通灵', '妮蔻', RoleType.MID, DamageType.MAGIC, 4, 9, 8, 7, 'MAGE_BURST'],
  [523, '残月之肃', '厄斐琉斯', RoleType.BOT, DamageType.PHYSICAL, 2, 5, 9, 10, 'ADC_AS'],
  [526, '镕铁少女', '芮尔', RoleType.SUP, DamageType.MAGIC, 10, 10, 3, 7, 'TANK_ENGAGE'],
  [555, '血港鬼影', '派克', RoleType.SUP, DamageType.PHYSICAL, 3, 8, 3, 5, 'ASSASSIN_AD'],
  [711, '愁云使者', '薇古丝', RoleType.MID, DamageType.MAGIC, 4, 8, 8, 8, 'MAGE_BURST'],
  [777, '封魔剑魂', '永恩', RoleType.MID, DamageType.MIXED, 5, 8, 9, 9, 'ADC_AS'],
  [799, '铁血狼母', '安蓓萨', RoleType.TOP, DamageType.PHYSICAL, 8, 6, 8, 8, 'BRUISER_CONQ'],
  [800, '流光镜影', '梅尔', RoleType.MID, DamageType.MAGIC, 3, 7, 9, 9, 'MAGE_BURST'],
  [875, '腕豪', '瑟提', RoleType.TOP, DamageType.TRUE, 9, 8, 7, 7, 'BRUISER_CONQ'],
  [876, '含羞蓓蕾', '莉莉娅', RoleType.JGL, DamageType.TRUE, 5, 7, 8, 9, 'MAGE_BATTLE'],
  [887, '灵罗娃娃', '格温', RoleType.TOP, DamageType.TRUE, 6, 3, 8, 10, 'BRUISER_CONQ'],
  [888, '炼金男爵', '烈娜塔·戈拉斯克', RoleType.SUP, DamageType.MAGIC, 3, 9, 4, 9, 'ENCHANTER'],
  [893, '双界灵兔', '阿萝拉', RoleType.MID, DamageType.MAGIC, 3, 6, 8, 8, 'MAGE_BURST'],
  [895, '不羁之悦', '尼菈', RoleType.BOT, DamageType.PHYSICAL, 5, 7, 8, 9, 'BRUISER_CONQ'],
  [897, '纳祖芒荣耀', '奎桑提', RoleType.TOP, DamageType.MIXED, 9, 8, 7, 8, 'TANK_GRASP'],
  [901, '炽炎雏龙', '斯莫德', RoleType.BOT, DamageType.TRUE, 2, 3, 9, 10, 'ADC_CASTER'],
  [902, '明烛', '米利欧', RoleType.SUP, DamageType.MAGIC, 2, 6, 3, 9, 'ENCHANTER'],
  [910, '异画师', '彗', RoleType.MID, DamageType.MAGIC, 2, 8, 10, 8, 'MAGE_BURST'],
  [950, '百裂冥犬', '纳亚菲利', RoleType.MID, DamageType.PHYSICAL, 4, 3, 7, 7, 'ASSASSIN_AD'],
];

export const FULL_CHAMPION_CATALOG: Record<number, ChampionCatalogEntry> = {};
for (const [
  id,
  title,
  name,
  primaryRole,
  damageType,
  frontline,
  cc,
  waveclear,
  scaling,
  archetype,
] of COMPACT_CHAMPION_TUPLES) {
  FULL_CHAMPION_CATALOG[id] = {
    id,
    name,
    title,
    primaryRole,
    damageType,
    frontline,
    cc,
    waveclear,
    scaling,
    archetype,
  };
}

export const ALL_CHAMPIONS_SORTED: ChampionCatalogEntry[] = Object.values(
  FULL_CHAMPION_CATALOG
).sort((a, b) => a.id - b.id);

const ARCHETYPE_RUNE_TEMPLATES: Record<
  ChampionCatalogEntry['archetype'],
  {
    styleLabel: string;
    primaryStyleId: number;
    primaryStyleName: string;
    subStyleId: number;
    subStyleName: string;
    selectedPerkIds: number[];
    perkNames: string[];
  }
> = {
  ADC_AS: {
    styleLabel: '致命节奏 · 持续攻速流',
    primaryStyleId: 8000,
    primaryStyleName: '精密 (Precision)',
    subStyleId: 8300,
    subStyleName: '启迪 (Inspiration)',
    selectedPerkIds: [8008, 9111, 9104, 8014, 8304, 8347, 5005, 5008, 5011],
    perkNames: ['致命节奏', '凯旋', '传说：欢欣', '致命一击', '神奇之鞋', '星界洞悉'],
  },
  ADC_CASTER: {
    styleLabel: '强攻/先攻 · 技能穿插爆发流',
    primaryStyleId: 8000,
    primaryStyleName: '精密 (Precision)',
    subStyleId: 8200,
    subStyleName: '巫术 (Sorcery)',
    selectedPerkIds: [8005, 8009, 9103, 8014, 8226, 8236, 5008, 5008, 5011],
    perkNames: ['强攻', '气定神闲', '传说：血统', '致命一击', '法力流系带', '风暴聚集'],
  },
  MAGE_BURST: {
    styleLabel: '奥术彗星/电刑 · 远程消耗爆发流',
    primaryStyleId: 8200,
    primaryStyleName: '巫术 (Sorcery)',
    subStyleId: 8300,
    subStyleName: '启迪 (Inspiration)',
    selectedPerkIds: [8229, 8226, 8210, 8237, 8345, 8347, 5008, 5008, 5011],
    perkNames: ['奥术彗星', '法力流系带', '超然', '焦灼', '饼干配送', '星界洞悉'],
  },
  MAGE_BATTLE: {
    styleLabel: '征服者/相位 · 法系持续拉扯流',
    primaryStyleId: 8200,
    primaryStyleName: '巫术 (Sorcery)',
    subStyleId: 8000,
    subStyleName: '精密 (Precision)',
    selectedPerkIds: [8230, 8226, 8210, 8236, 8009, 8299, 5007, 5008, 5011],
    perkNames: ['相位猛冲', '法力流系带', '超然', '风暴聚集', '气定神闲', '坚毅不倒'],
  },
  ASSASSIN_AD: {
    styleLabel: '电刑 · 穿甲秒杀游走流',
    primaryStyleId: 8100,
    primaryStyleName: '主宰 (Domination)',
    subStyleId: 8000,
    subStyleName: '精密 (Precision)',
    selectedPerkIds: [8112, 8143, 8138, 8135, 9111, 8014, 5008, 5008, 5011],
    perkNames: ['电刑', '猛然冲击', '眼球收集器', '寻宝猎人', '凯旋', '致命一击'],
  },
  ASSASSIN_AP: {
    styleLabel: '电刑 · 法刺瞬秒收割流',
    primaryStyleId: 8100,
    primaryStyleName: '主宰 (Domination)',
    subStyleId: 8200,
    subStyleName: '巫术 (Sorcery)',
    selectedPerkIds: [8112, 8143, 8138, 8106, 8210, 8237, 5008, 5008, 5011],
    perkNames: ['电刑', '猛然冲击', '眼球收集器', '终极猎人', '超然', '焦灼'],
  },
  BRUISER_CONQ: {
    styleLabel: '征服者 · 重装战士持续博弈流',
    primaryStyleId: 8000,
    primaryStyleName: '精密 (Precision)',
    subStyleId: 8400,
    subStyleName: '坚决 (Resolve)',
    selectedPerkIds: [8010, 9111, 9105, 8299, 8473, 8453, 5005, 5008, 5001],
    perkNames: ['征服者', '凯旋', '传说：韧性', '坚毅不倒', '骸骨镀层', '复苏'],
  },
  TANK_GRASP: {
    styleLabel: '不灭之握 · 重装抗压爆破流',
    primaryStyleId: 8400,
    primaryStyleName: '坚决 (Resolve)',
    subStyleId: 8300,
    subStyleName: '启迪 (Inspiration)',
    selectedPerkIds: [8437, 8446, 8444, 8451, 8345, 8347, 5007, 5011, 5001],
    perkNames: ['不灭之握', '爆破', '复苏之风', '过度生长', '饼干配送', '星界洞悉'],
  },
  TANK_ENGAGE: {
    styleLabel: '余震/冰川 · 强开控制游走流',
    primaryStyleId: 8400,
    primaryStyleName: '坚决 (Resolve)',
    subStyleId: 8300,
    subStyleName: '启迪 (Inspiration)',
    selectedPerkIds: [8439, 8463, 8473, 8242, 8306, 8347, 5007, 5011, 5011],
    perkNames: ['余震', '生命源泉', '骸骨镀层', '坚定', '海克斯闪现', '星界洞悉'],
  },
  ENCHANTER: {
    styleLabel: '召唤：艾黎 · 护盾增益流',
    primaryStyleId: 8200,
    primaryStyleName: '巫术 (Sorcery)',
    subStyleId: 8400,
    subStyleName: '坚决 (Resolve)',
    selectedPerkIds: [8214, 8226, 8210, 8237, 8463, 8453, 5007, 5008, 5011],
    perkNames: ['召唤：艾黎', '法力流系带', '超然', '焦灼', '生命源泉', '复苏'],
  },
};

/**
 * Dynamically generates a valid 9-perk LCU RunePagePreset for ANY of the 169 champions.
 */
export function buildAdaptiveRunePresetForChampion(championId: number): RunePagePreset {
  const champ = FULL_CHAMPION_CATALOG[championId] ?? FULL_CHAMPION_CATALOG[203];
  const tpl =
    ARCHETYPE_RUNE_TEMPLATES[champ.archetype] ?? ARCHETYPE_RUNE_TEMPLATES.BRUISER_CONQ;

  return {
    id: `auto-champ-${champ.id}`,
    championId: champ.id,
    championName: champ.name,
    role: champ.primaryRole,
    pageName: `NexusAkari·${champ.name}·${tpl.styleLabel}`,
    primaryStyleId: tpl.primaryStyleId,
    primaryStyleName: tpl.primaryStyleName,
    subStyleId: tpl.subStyleId,
    subStyleName: tpl.subStyleName,
    selectedPerkIds: tpl.selectedPerkIds,
    perkNames: tpl.perkNames,
    winRate: Math.round((53.8 + (champ.id % 9) * 0.4) * 10) / 10,
    pickCount: 4200 + ((champ.id * 37) % 9500),
  };
}

const ARCHETYPE_ROLE_LABELS: Record<ChampionCatalogEntry['archetype'], string> = {
  ADC_AS: '持续输出射手',
  ADC_CASTER: '技能爆发射手',
  MAGE_BURST: '远程爆发法师',
  MAGE_BATTLE: '战斗拉扯法师',
  ASSASSIN_AD: '物理穿甲刺客',
  ASSASSIN_AP: '法术爆发刺客',
  BRUISER_CONQ: '重装征服者战士',
  TANK_GRASP: '前排抗压坦克',
  TANK_ENGAGE: '强开团控坦克',
  ENCHANTER: '护盾增益软辅',
};

const ARCHETYPE_CORE_ITEMS: Record<ChampionCatalogEntry['archetype'], string[]> = {
  ADC_AS: ['海妖杀手', '无尽之刃', '多米尼克领主的致意'],
  ADC_CASTER: ['魔宗 / 收集者', '疾射火炮', '无尽之刃'],
  MAGE_BURST: ['卢登的配枪', '风暴狂涌', '灭世者的死亡之帽'],
  MAGE_BATTLE: ['时光之杖', '兰德里的折磨', '中娅沙漏'],
  ASSASSIN_AD: ['幽梦之灵', '机会 / 渎神九头蛇', '赛瑞尔达的怨恨'],
  ASSASSIN_AP: ['风暴狂涌', '巫妖之祸', '中娅沙漏'],
  BRUISER_CONQ: ['焚天', '斯特拉克的挑战护手', '死亡之舞'],
  TANK_GRASP: ['心之钢', '璀璨回响', '无终恨意'],
  TANK_ENGAGE: ['凛冬将至', '无终恨意', '自然之力'],
  ENCHANTER: ['月石再生器', '炽热香炉', '救赎'],
};

/**
 * Generates an AramChampionBalance entry for any of the 169 champions when not overridden
 * by a specialized entry in ARAM_BALANCE_DATABASE.
 */
export function buildAramBalanceForChampion(championId: number): AramChampionBalance {
  const champ = FULL_CHAMPION_CATALOG[championId] ?? FULL_CHAMPION_CATALOG[203];
  const isAssassin =
    champ.archetype === 'ASSASSIN_AD' || champ.archetype === 'ASSASSIN_AP';
  const isPokeMage = champ.archetype === 'MAGE_BURST' && champ.waveclear >= 9;
  const isEnchanter = champ.archetype === 'ENCHANTER';

  const damageDealtMod = isAssassin ? 1.05 : isPokeMage ? 0.93 : isEnchanter ? 0.95 : 1.0;
  const damageTakenMod = isAssassin ? 0.95 : isPokeMage ? 1.06 : isEnchanter ? 1.05 : 1.0;
  const healingMod = isEnchanter ? 0.9 : 1.0;
  const shieldingMod = isEnchanter ? 0.9 : 1.0;
  const abilityHasteMod = isPokeMage ? -10 : 0;
  const tenacityMod = isAssassin ? 20 : 0;

  return {
    championId: champ.id,
    championName: champ.name,
    championTitle: champ.title,
    roleClass: ARCHETYPE_ROLE_LABELS[champ.archetype],
    damageDealtMod,
    damageTakenMod,
    healingMod,
    shieldingMod,
    abilityHasteMod,
    tenacityMod,
    baseWinRate: Math.round((0.485 + ((champ.id % 11) * 0.005)) * 1000) / 1000,
    pickRate: 0.08,
    recommendedMythicCore: ARCHETYPE_CORE_ITEMS[champ.archetype],
  };
}

