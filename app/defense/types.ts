export type OrganType = "heart" | "lung" | "liver";
export type EnemyType = "stress" | "dust" | "alcohol" | "overwork";
export type GamePhase = "prep" | "wave" | "cards" | "victory" | "defeat";

export interface OrganConfig {
  id: OrganType; name: string; emoji: string; role: string; color: string;
  baseDamage: number; baseAttackSpeed: number; range: number; maxLevel: number;
  bonusAgainst?: EnemyType; bonusMultiplier?: number; splash?: number;
}
export interface EnemyConfig {
  id: EnemyType; name: string; glyph: string; color: string;
  maxHp: number; speed: number; reward: number; lifeDamage: number;
}
export interface WaveGroup { type: EnemyType; count: number; spawnInterval: number }
export interface WaveConfig { wave: number; label: string; groups: WaveGroup[] }
export interface NextWaveEffects {
  attackSpeed: number; enemySpeed: number; extraEnemies: EnemyType[];
}
export interface HabitCard {
  id: string; name: string; icon: string; description: string; drawback?: string;
  effectType: "permanent" | "nextWave" | "instant" | "choice";
}
export interface OrganState { id: OrganType; level: number }
export interface HudState {
  phase: GamePhase; wave: number; life: number; nutrients: number; elapsed: number;
  remaining: number; countdown: number; kills: number; selected: OrganType;
  organs: Record<OrganType, OrganState>; cards: HabitCard[]; message: string;
}
