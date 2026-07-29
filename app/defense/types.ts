export type OrganType = "heart" | "lung" | "liver";
export type EnemyType = "stress" | "dust" | "alcohol" | "sugar" | "caffeine" | "fatigue" | "overwork";
export type GamePhase = "prep" | "wave" | "cards" | "victory" | "defeat";
export type AbilityId = "breath" | "detox" | "adrenaline";
export type TargetMode = "first" | "last" | "strong";

export interface OrganConfig {
  id: OrganType; name: string; emoji: string; role: string; color: string;
  baseDamage: number; baseAttackSpeed: number; range: number; maxLevel: number;
  bonusAgainst?: EnemyType; bonusMultiplier?: number; splash?: number;
  ability: AbilityConfig;
}
export interface AbilityConfig {
  id: AbilityId; name: string; icon: string; description: string; cooldown: number; duration: number;
}
export interface EnemyConfig {
  id: EnemyType; name: string; glyph: string; color: string;
  maxHp: number; speed: number; reward: number; lifeDamage: number;
  // 특수 행동 플래그
  regen?: number;      // 초당 자가 회복 (만성피로)
  sprint?: boolean;    // 주기적 질주 (과로 보스)
  boss?: boolean;
}
export interface WaveGroup { type: EnemyType; count: number; spawnInterval: number; delay?: number }
export interface WaveConfig { wave: number; clock: string; label: string; flavor: string; groups: WaveGroup[] }
export interface NextWaveEffects {
  attackSpeed: number; enemySpeed: number; extraEnemies: EnemyType[];
}
export interface HabitCard {
  id: string; name: string; icon: string; description: string; drawback?: string;
  effectType: "permanent" | "nextWave" | "instant" | "choice";
}
export interface OrganState { id: OrganType; level: number }
export interface AbilityState { id: AbilityId; cooldown: number; ready: boolean; active: number }
export interface HudState {
  phase: GamePhase; wave: number; totalWaves: number; life: number; maxLife: number;
  nutrients: number; elapsed: number; remaining: number; countdown: number; kills: number;
  combo: number; bestCombo: number; speed: number; targetMode: TargetMode;
  selected: OrganType; organs: Record<OrganType, OrganState>;
  abilities: Record<OrganType, AbilityState>;
  cards: HabitCard[]; message: string; clock: string; flavor: string;
}
