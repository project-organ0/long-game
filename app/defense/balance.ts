import type { EnemyConfig, EnemyType, HabitCard, OrganConfig, OrganType, WaveConfig } from "./types";

export const GAME_BALANCE = {
  initialLife: 12,
  maxLife: 12,
  initialNutrients: 90,
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
    bonusAgainst: "alcohol", bonusMultiplier: 1.9,
    ability: { id: "detox", name: "해독", icon: "🧪", description: "사거리 내 모든 적에게 5초간 강력한 독 도트", cooldown: 18, duration: 5 },
  },
  heart: {
    id: "heart", name: "심장", emoji: "🫀", role: "맥박탄 · 초고속 단일", color: "#ff647c",
    baseDamage: 11, baseAttackSpeed: 1.9, range: 172, maxLevel: 5,
    bonusAgainst: "caffeine", bonusMultiplier: 1.8,
    ability: { id: "adrenaline", name: "아드레날린", icon: "💓", description: "5초간 모든 장기 공격속도 2배", cooldown: 20, duration: 5 },
  },
};

export const ENEMIES: Record<EnemyType, EnemyConfig> = {
  stress:   { id: "stress",   name: "스트레스", glyph: "⚡", color: "#9d7cff", maxHp: 42,  speed: 46, reward: 11, lifeDamage: 1 },
  dust:     { id: "dust",     name: "미세먼지", glyph: "✹", color: "#8b94a4", maxHp: 30,  speed: 72, reward: 12, lifeDamage: 1 },
  alcohol:  { id: "alcohol",  name: "알코올",   glyph: "♨", color: "#e9a85d", maxHp: 120, speed: 34, reward: 26, lifeDamage: 2 },
  sugar:    { id: "sugar",    name: "과식",     glyph: "◍", color: "#ff9ec7", maxHp: 88,  speed: 40, reward: 20, lifeDamage: 2 },
  caffeine: { id: "caffeine", name: "카페인",   glyph: "☕", color: "#c9a06a", maxHp: 26,  speed: 108,reward: 14, lifeDamage: 1 },
  fatigue:  { id: "fatigue",  name: "만성피로", glyph: "☾", color: "#6f7bd6", maxHp: 460, speed: 30, reward: 120,lifeDamage: 3, regen: 14, boss: true },
  overwork: { id: "overwork", name: "과로",     glyph: "☠", color: "#ff4364", maxHp: 900, speed: 28, reward: 320,lifeDamage: 5, sprint: true, boss: true },
};

// 웨이브 = 하루의 시간대. 각 시간대의 위협 조합이 테마와 맞물린다.
export const WAVES: WaveConfig[] = [
  { wave: 1, clock: "06:00", label: "기상", flavor: "아직은 개운한 아침. 잔잔한 스트레스뿐.",
    groups: [{ type: "stress", count: 7, spawnInterval: 0.95 }] },
  { wave: 2, clock: "08:00", label: "출근길", flavor: "매연과 인파 사이, 먼지가 밀려온다.",
    groups: [{ type: "stress", count: 6, spawnInterval: 0.7 }, { type: "dust", count: 8, spawnInterval: 0.55, delay: 1.5 }] },
  { wave: 3, clock: "12:00", label: "점심 과식", flavor: "든든하게, 어쩌면 너무 든든하게.",
    groups: [{ type: "stress", count: 5, spawnInterval: 0.6 }, { type: "sugar", count: 6, spawnInterval: 0.85 }] },
  { wave: 4, clock: "15:00", label: "오후 근무", flavor: "밀린 업무가 몰아친다. 정신없이 바쁘다.",
    groups: [{ type: "stress", count: 9, spawnInterval: 0.42 }, { type: "dust", count: 6, spawnInterval: 0.5, delay: 2 }, { type: "caffeine", count: 4, spawnInterval: 0.7, delay: 3 }] },
  { wave: 5, clock: "18:00", label: "회식", flavor: "\"딱 한 잔만\"이 시작되는 시간.",
    groups: [{ type: "sugar", count: 5, spawnInterval: 0.6 }, { type: "alcohol", count: 7, spawnInterval: 0.8 }, { type: "stress", count: 4, spawnInterval: 0.5, delay: 1 }] },
  { wave: 6, clock: "21:00", label: "야근", flavor: "카페인으로 버티는 밤. 심장이 빨라진다.",
    groups: [{ type: "stress", count: 8, spawnInterval: 0.4 }, { type: "caffeine", count: 8, spawnInterval: 0.4, delay: 1.5 }, { type: "dust", count: 5, spawnInterval: 0.45, delay: 3 }] },
  { wave: 7, clock: "24:00", label: "야식·폭음", flavor: "만성피로가 몸 깊숙이 자리 잡는다.",
    groups: [{ type: "alcohol", count: 6, spawnInterval: 0.7 }, { type: "sugar", count: 6, spawnInterval: 0.6, delay: 1 }, { type: "fatigue", count: 1, spawnInterval: 0.1, delay: 4 }] },
  { wave: 8, clock: "03:00", label: "새벽 · 총력전", flavor: "몸이 한계에 다다랐다. 과로가 온다.",
    groups: [{ type: "stress", count: 8, spawnInterval: 0.35 }, { type: "caffeine", count: 6, spawnInterval: 0.4, delay: 1 }, { type: "alcohol", count: 5, spawnInterval: 0.6, delay: 2 }, { type: "sugar", count: 5, spawnInterval: 0.55, delay: 3 }, { type: "overwork", count: 1, spawnInterval: 0.1, delay: 6 }] },
];

export const HABIT_CARDS: HabitCard[] = [
  { id: "exercise", name: "운동", icon: "🏃", description: "모든 장기의 공격력 +12% (영구)", effectType: "permanent" },
  { id: "sleep", name: "충분한 수면", icon: "🌙", description: "생명력 3 회복", effectType: "instant" },
  { id: "checkup", name: "건강검진", icon: "🩺", description: "가장 낮은 레벨 장기 무료 강화", drawback: "모두 최대면 영양분 +120", effectType: "instant" },
  { id: "vitamin", name: "영양제", icon: "💊", description: "액티브 스킬 쿨다운 즉시 초기화", effectType: "instant" },
  { id: "energy", name: "에너지 드링크", icon: "⚡", description: "다음 웨이브 공격속도 +35%", drawback: "웨이브 종료 후 해제", effectType: "nextWave" },
  { id: "snack", name: "야식", icon: "🍜", description: "영양분 즉시 +130", drawback: "다음 웨이브에 과식 3기 추가", effectType: "nextWave" },
  { id: "allnight", name: "밤샘", icon: "🦉", description: "선택 장기 무료 강화", drawback: "생명력 -2", effectType: "choice" },
  { id: "drinks", name: "술자리", icon: "🍻", description: "영양분 즉시 +180", drawback: "다음 웨이브에 알코올 2기 추가", effectType: "nextWave" },
  { id: "meditation", name: "명상", icon: "🧘", description: "다음 웨이브 적 이동속도 -18%", effectType: "nextWave" },
  { id: "walk", name: "산책", icon: "🚶", description: "생명력 1 회복 + 영양분 +60", effectType: "instant" },
];
