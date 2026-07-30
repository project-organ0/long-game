import type { EnemyConfig, EnemyType, HabitCard, OrganConfig, OrganType, TowerConfig, TowerType, WaveConfig } from "./types";

export const GAME_BALANCE = {
  initialLife: 12,
  maxLife: 12,
  initialNutrients: 120,
  stemCost: 25,
  differentiationCost: 45,
  specializationCost: 85,
  prepSeconds: 8,
  maxOrganLevel: 5,
  // 레벨별 업그레이드 비용 (Lv1→2 ... Lv4→5)
  organUpgradeCosts: [40, 75, 130, 210],
  // 레벨별 성장 배율 (index = level-1)
  levelDamageMultiplier: [1, 1.4, 1.9, 2.5, 3.25],
  levelSpeedMultiplier: [1, 1.12, 1.26, 1.42, 1.6],
  levelRangeMultiplier: [1, 1.06, 1.13, 1.2, 1.28],
  damagePermanentStep: 0.12,
  // 조기 시작 이자: 남은 prep 1초당 영양분
  earlyStartInterest: 4,
  // 콤보: n킬마다 보상 배수 1단계 상승, 최대 3배
  comboStep: 5,
  comboMax: 3,
  speedOptions: [1, 2, 3] as const,
} as const;

export const ORGANS: Record<OrganType, OrganConfig> = {
  lung: {
    id: "lung", name: "폐", emoji: "🫁", role: "공기 파동 · 광역 요격", color: "#6dd6d0",
    baseDamage: 12, baseAttackSpeed: 0.95, range: 178, maxLevel: 5,
    bonusAgainst: "dust", bonusMultiplier: 1.7, splash: 64,
    ability: { id: "breath", name: "심호흡", icon: "🌬", description: "사거리 전체에 정화 폭발 · 3초간 적 이동 -55%", cooldown: 16, duration: 3 },
  },
  liver: {
    id: "liver", name: "간", emoji: "🟤", role: "해독탄 · 알코올/당 특화", color: "#e9a85d",
    baseDamage: 30, baseAttackSpeed: 0.56, range: 188, maxLevel: 5,
    bonusAgainst: "toxin", bonusMultiplier: 1.9,
    ability: { id: "detox", name: "해독", icon: "🧪", description: "사거리 내 모든 적에게 5초간 강력한 독 도트", cooldown: 18, duration: 5 },
  },
  heart: {
    id: "heart", name: "심장", emoji: "🫀", role: "맥박탄 · 초고속 단일", color: "#ff647c",
    baseDamage: 11, baseAttackSpeed: 1.9, range: 172, maxLevel: 5,
    bonusAgainst: "virus", bonusMultiplier: 1.8,
    ability: { id: "adrenaline", name: "혈류 조절", icon: "💓", description: "5초간 전체 혈류를 52% 늦추고 심장 부담을 낮춤", cooldown: 20, duration: 5 },
  },
};

export const ENEMIES: Record<EnemyType, EnemyConfig> = {
  bacteria:     { id:"bacteria", name:"세균 군체", glyph:"●", color:"#76507d", maxHp:46, speed:48, reward:12, lifeDamage:1, split:true },
  dust:         { id:"dust", name:"미세먼지 뭉치", glyph:"●", color:"#777b7e", maxHp:92, speed:32, reward:18, lifeDamage:1 },
  toxin:        { id:"toxin", name:"독소 방울", glyph:"●", color:"#778447", maxHp:76, speed:40, reward:20, lifeDamage:2, debuff:true },
  fat:          { id:"fat", name:"지방 덩어리", glyph:"●", color:"#e3b84f", maxHp:180, speed:24, reward:30, lifeDamage:2 },
  virus:        { id:"virus", name:"캡슐 바이러스", glyph:"●", color:"#665b9b", maxHp:34, speed:105, reward:16, lifeDamage:1, dodge:true },
  inflammation: { id:"inflammation", name:"만성 염증 코어", glyph:"◆", color:"#d36562", maxHp:1100, speed:22, reward:360, lifeDamage:5, regen:10, sprint:true, boss:true },
};

export const CELL_TOWERS: Record<TowerType, TowerConfig> = {
  stem:  { id:"stem", name:"미분화 세포", family:"lung", role:"주변 환경을 읽으며 성장", cost:25, damage:5, attackSpeed:.7, range:105, color:"#eee2c7" },
  lung:  { id:"lung", name:"폐포 세포", family:"lung", role:"미세먼지 특화 광역 정화", cost:45, damage:13, attackSpeed:1.0, range:150, splash:55, bonusAgainst:"dust", bonusMultiplier:2.1, color:"#6dd6d0" },
  liver: { id:"liver", name:"간세포", family:"liver", role:"독소에 강한 지속 해독", cost:45, damage:20, attackSpeed:.72, range:158, bonusAgainst:"toxin", bonusMultiplier:2.2, color:"#d9b050" },
  heart: { id:"heart", name:"심장 세포", family:"heart", role:"바이러스 저지·고속 응고", cost:45, damage:9, attackSpeed:1.85, range:138, splash:30, bonusAgainst:"virus", bonusMultiplier:2, color:"#ef786d" },
};

// 웨이브 = 하루의 시간대. 각 시간대의 위협 조합이 테마와 맞물린다.
export const WAVES: WaveConfig[] = [
  { wave:1, clock:"06:00", label:"세균 유입", flavor:"작은 군체가 혈관을 타고 침입한다.", groups:[{type:"bacteria",count:8,spawnInterval:.85}] },
  { wave:2, clock:"08:00", label:"회색 공기", flavor:"압축된 미세먼지가 방벽을 만든다.", groups:[{type:"bacteria",count:6,spawnInterval:.65},{type:"dust",count:5,spawnInterval:.9,delay:1.2}] },
  { wave:3, clock:"11:00", label:"독소 확산", flavor:"끈적한 독소가 세포의 힘을 빼앗는다.", groups:[{type:"bacteria",count:6,spawnInterval:.55},{type:"toxin",count:6,spawnInterval:.8,delay:1}] },
  { wave:4, clock:"14:00", label:"캡슐 습격", flavor:"빠른 바이러스가 방어선을 시험한다.", groups:[{type:"virus",count:10,spawnInterval:.4},{type:"dust",count:5,spawnInterval:.75,delay:1.4}] },
  { wave:5, clock:"18:00", label:"지방 정체", flavor:"거대한 지방 덩어리가 혈류를 막는다.", groups:[{type:"fat",count:5,spawnInterval:1.1},{type:"toxin",count:7,spawnInterval:.62,delay:1}] },
  { wave:6, clock:"21:00", label:"혼합 감염", flavor:"서로 다른 침입자들이 한꺼번에 몰려온다.", groups:[{type:"bacteria",count:8,spawnInterval:.4},{type:"virus",count:8,spawnInterval:.38,delay:1},{type:"toxin",count:5,spawnInterval:.55,delay:2}] },
  { wave:7, clock:"24:00", label:"혈관 봉쇄", flavor:"먼지와 지방이 길을 가득 메운다.", groups:[{type:"dust",count:7,spawnInterval:.65},{type:"fat",count:6,spawnInterval:.85,delay:1.5},{type:"virus",count:6,spawnInterval:.36,delay:3}] },
  { wave:8, clock:"03:00", label:"만성 염증", flavor:"모든 이상 반응이 하나의 코어로 뭉쳤다.", groups:[{type:"bacteria",count:7,spawnInterval:.35},{type:"toxin",count:5,spawnInterval:.5,delay:1},{type:"virus",count:6,spawnInterval:.35,delay:2},{type:"inflammation",count:1,spawnInterval:.1,delay:5}] },
];

export const HABIT_CARDS: HabitCard[] = [
  { id: "exercise", name: "운동", icon: "🏃", description: "모든 장기의 공격력 +12% (영구)", effectType: "permanent" },
  { id: "sleep", name: "충분한 수면", icon: "🌙", description: "생명력 3 회복", effectType: "instant" },
  { id: "checkup", name: "건강검진", icon: "🩺", description: "가장 낮은 레벨 장기 무료 강화", drawback: "모두 최대면 영양분 +120", effectType: "instant" },
  { id: "vitamin", name: "영양제", icon: "💊", description: "액티브 스킬 쿨다운 즉시 초기화", effectType: "instant" },
  { id: "energy", name: "에너지 드링크", icon: "⚡", description: "다음 웨이브 공격속도 +35%", drawback: "웨이브 종료 후 해제", effectType: "nextWave" },
  { id: "snack", name: "야식", icon: "🍜", description: "영양분 즉시 +130", drawback: "다음 웨이브에 지방 3기 추가", effectType: "nextWave" },
  { id: "allnight", name: "밤샘", icon: "🦉", description: "선택 장기 무료 강화", drawback: "생명력 -2", effectType: "choice" },
  { id: "drinks", name: "술자리", icon: "🍻", description: "영양분 즉시 +180", drawback: "다음 웨이브에 독소 2기 추가", effectType: "nextWave" },
  { id: "meditation", name: "명상", icon: "🧘", description: "다음 웨이브 적 이동속도 -18%", effectType: "nextWave" },
  { id: "walk", name: "산책", icon: "🚶", description: "생명력 1 회복 + 영양분 +60", effectType: "instant" },
];
