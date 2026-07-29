import type { EnemyConfig, EnemyType, HabitCard, OrganConfig, OrganType, WaveConfig } from "./types";

export const GAME_BALANCE = {
  initialLife: 10,
  maxLife: 10,
  initialNutrients: 60,
  prepSeconds: 5,
  organUpgradeCosts: [50, 100],
  levelDamageMultiplier: [1, 1.45, 2.05],
  levelSpeedMultiplier: [1, 1.15, 1.32],
  levelRangeMultiplier: [1, 1.08, 1.18],
  damagePermanentStep: 0.1,
} as const;

export const ORGANS: Record<OrganType, OrganConfig> = {
  lung: { id: "lung", name: "폐", emoji: "🫁", role: "공기 파동 · 광역 공격", color: "#6dd6d0", baseDamage: 13, baseAttackSpeed: 0.9, range: 175, maxLevel: 3, bonusAgainst: "dust", bonusMultiplier: 1.6, splash: 60 },
  liver: { id: "liver", name: "간", emoji: "🟤", role: "해독탄 · 알코올 특화", color: "#e9a85d", baseDamage: 28, baseAttackSpeed: 0.52, range: 185, maxLevel: 3, bonusAgainst: "alcohol", bonusMultiplier: 1.8 },
  heart: { id: "heart", name: "심장", emoji: "🫀", role: "맥박탄 · 빠른 단일 공격", color: "#ff647c", baseDamage: 10, baseAttackSpeed: 1.75, range: 170, maxLevel: 3 },
};

export const ENEMIES: Record<EnemyType, EnemyConfig> = {
  stress: { id: "stress", name: "스트레스", glyph: "⚡", color: "#9d7cff", maxHp: 45, speed: 44, reward: 13, lifeDamage: 1 },
  dust: { id: "dust", name: "미세먼지", glyph: "✹", color: "#7b8494", maxHp: 36, speed: 67, reward: 15, lifeDamage: 1 },
  alcohol: { id: "alcohol", name: "알코올", glyph: "♨", color: "#e9a85d", maxHp: 105, speed: 36, reward: 28, lifeDamage: 2 },
  overwork: { id: "overwork", name: "과로", glyph: "☠", color: "#ff4364", maxHp: 700, speed: 29, reward: 250, lifeDamage: 6 },
};

export const WAVES: WaveConfig[] = [
  { wave: 1, label: "작은 스트레스", groups: [{ type: "stress", count: 7, spawnInterval: 0.9 }] },
  { wave: 2, label: "탁한 출근길", groups: [{ type: "stress", count: 6, spawnInterval: 0.72 }, { type: "dust", count: 6, spawnInterval: 0.65 }] },
  { wave: 3, label: "회식의 유혹", groups: [{ type: "stress", count: 5, spawnInterval: 0.62 }, { type: "alcohol", count: 5, spawnInterval: 0.9 }] },
  { wave: 4, label: "나쁜 습관 총공세", groups: [{ type: "stress", count: 7, spawnInterval: 0.5 }, { type: "dust", count: 7, spawnInterval: 0.46 }, { type: "alcohol", count: 5, spawnInterval: 0.7 }] },
  { wave: 5, label: "과로 주의보", groups: [{ type: "stress", count: 5, spawnInterval: 0.42 }, { type: "dust", count: 5, spawnInterval: 0.4 }, { type: "alcohol", count: 4, spawnInterval: 0.6 }, { type: "overwork", count: 1, spawnInterval: 0.1 }] },
];

export const HABIT_CARDS: HabitCard[] = [
  { id: "exercise", name: "운동", icon: "🏃", description: "모든 장기의 공격력 +10%", effectType: "permanent" },
  { id: "sleep", name: "충분한 수면", icon: "🌙", description: "생명력 2 회복", effectType: "instant" },
  { id: "checkup", name: "건강검진", icon: "🩺", description: "가장 낮은 레벨 장기 무료 강화", drawback: "모두 최대면 영양분 +80", effectType: "instant" },
  { id: "energy", name: "에너지 드링크", icon: "⚡", description: "다음 웨이브 공격속도 +30%", drawback: "웨이브 종료 후 효과 해제", effectType: "nextWave" },
  { id: "snack", name: "야식", icon: "🍜", description: "영양분 즉시 +100", drawback: "다음 웨이브에 적 3마리 추가", effectType: "nextWave" },
  { id: "allnight", name: "밤샘", icon: "🦉", description: "선택 장기 무료 강화", drawback: "생명력 -2", effectType: "choice" },
  { id: "drinks", name: "술자리", icon: "🍻", description: "영양분 즉시 +150", drawback: "다음 웨이브에 알코올 2기 추가", effectType: "nextWave" },
  { id: "meditation", name: "명상", icon: "🧘", description: "다음 웨이브 적 이동속도 -15%", effectType: "nextWave" },
];
