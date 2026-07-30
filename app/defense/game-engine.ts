import { CELL_TOWERS, ENEMIES, GAME_BALANCE, HABIT_CARDS, ORGANS, WAVES } from "./balance";
import type { EnemyType, GamePhase, HabitCard, HudState, NextWaveEffects, OrganState, OrganType, TargetMode, TowerBranch, TowerType } from "./types";

type Point = { x: number; y: number };
type Enemy = {
  id: number; type: EnemyType; hp: number; maxHp: number; speed: number; path: number; x: number; y: number;
  hit: number; dead: number; slow: number; poison: number; poisonDps: number; regenClock: number;
};
type Projectile = { x: number; y: number; tx: number; ty: number; target: number; organ: OrganType; damage: number; color: string; splash: number; life: number };
type Floater = { x: number; y: number; text: string; color: string; life: number; size: number };
type Particle = { x: number; y: number; vx: number; vy: number; color: string; life: number };
type Tracer = { x: number; y: number; tx: number; ty: number; color: string; life: number };
type Ring = { x: number; y: number; r: number; maxR: number; color: string; life: number; width: number };
type Spawn = { type: EnemyType; at: number };
type PlacedTower = { id: number; type: TowerType; slot: number; level: number; branch?: TowerBranch; cooldown: number; attackAnim: number };

const PATH: Point[] = [{ x: -35, y: 130 }, { x: 170, y: 130 }, { x: 250, y: 280 }, { x: 475, y: 280 }, { x: 585, y: 450 }, { x: 790, y: 450 }, { x: 930, y: 310 }, { x: 1035, y: 310 }];
const ORGAN_POS: Record<OrganType, Point> = { lung: { x: 220, y: 185 }, liver: { x: 515, y: 385 }, heart: { x: 790, y: 300 } };
const TYPES: OrganType[] = ["lung", "liver", "heart"];
const CORE: Point = { x: 945, y: 310 };
const TOWER_SLOTS: Point[] = [
  { x:105,y:68 },{ x:310,y:205 },{ x:360,y:355 },{ x:470,y:170 },
  { x:620,y:350 },{ x:690,y:520 },{ x:840,y:400 },{ x:900,y:205 },
];

export class DefenseEngine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private uiTick = 0;
  private phase: GamePhase = "prep";
  private wave = 1;
  private life: number = GAME_BALANCE.initialLife;
  private nutrients: number = GAME_BALANCE.initialNutrients;
  private elapsed = 0;
  private countdown: number = GAME_BALANCE.prepSeconds;
  private kills = 0;
  private combo = 0;
  private bestCombo = 0;
  private comboTimer = 0;
  private speed = 1;
  private targetMode: TargetMode = "first";
  private selected: OrganType = "heart";
  private paused = false;
  private permanentDamage = 1;
  private adrenaline = 0; // 남은 초
  private strain: Record<OrganType, number> = { lung: 0, liver: 0, heart: 0 };
  private overloadTick = 1;
  private towers: PlacedTower[] = [];
  private selectedSlot: number | null = 0;
  private towerId = 0;
  private guardianSprites = new Image();
  private next: NextWaveEffects = { attackSpeed: 1, enemySpeed: 1, extraEnemies: [] };
  private organCooldown: Record<OrganType, number> = { lung: 0, liver: 0, heart: 0 };
  private abilityCd: Record<OrganType, number> = { lung: 0, liver: 0, heart: 0 };
  private organs: Record<OrganType, OrganState> = { lung: { id: "lung", level: 1 }, liver: { id: "liver", level: 1 }, heart: { id: "heart", level: 1 } };
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private rings: Ring[] = [];
  private queue: Spawn[] = [];
  private spawnClock = 0;
  private enemyId = 0;
  private cards: HabitCard[] = [];
  private message = "방어 준비";
  private flash = 0;
  private shake = 0;

  constructor(private canvas: HTMLCanvasElement, private onHud: (hud: HudState) => void) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    this.ctx = ctx;
    this.guardianSprites.src = "/art/cell-guardians-v1.png";
    canvas.addEventListener("pointerdown", this.onPointer);
    this.emit();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
  }

  togglePause() { this.paused = !this.paused; this.message = this.paused ? "잠시 숨 고르는 중" : "방어 재개"; this.emit(); }
  isPaused() { return this.paused; }
  selectOrgan(id: OrganType) { this.selected = id; this.selectedSlot = null; this.emit(); }
  setSpeed(mult: number) { this.speed = mult; this.emit(); }
  cycleTargetMode() {
    const order: TargetMode[] = ["first", "last", "strong"];
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length];
    this.emit();
  }

  buildTower(type: TowerType) {
    if (this.selectedSlot === null || this.towers.some((t) => t.slot === this.selectedSlot)) return false;
    const config = CELL_TOWERS[type];
    if (this.nutrients < config.cost) { this.message = "영양분이 부족합니다"; this.emit(); return false; }
    this.nutrients -= config.cost;
    this.towers.push({ id: ++this.towerId, type, slot: this.selectedSlot, level: 1, cooldown: .15, attackAnim: 0 });
    const p = TOWER_SLOTS[this.selectedSlot];
    this.rings.push({ x:p.x,y:p.y,r:8,maxR:54,color:config.color,life:.65,width:4 });
    this.message = `${config.name} 배치 완료`;
    this.emit(); return true;
  }

  upgradeTower(branch: TowerBranch) {
    if (this.selectedSlot === null) return false;
    const tower = this.towers.find((t) => t.slot === this.selectedSlot);
    if (!tower || tower.level >= 3) return false;
    const cost = 35 + tower.level * 35;
    if (this.nutrients < cost) { this.message = "영양분이 부족합니다"; this.emit(); return false; }
    this.nutrients -= cost; tower.level++; tower.branch ??= branch;
    const p=TOWER_SLOTS[tower.slot], color=CELL_TOWERS[tower.type].color;
    this.rings.push({x:p.x,y:p.y,r:8,maxR:70,color,life:.7,width:5});
    this.message=`${CELL_TOWERS[tower.type].name} · ${tower.branch==="power"?"공격 분화":"기능 분화"} Lv.${tower.level}`;
    this.emit(); return true;
  }

  sellTower() {
    if (this.selectedSlot === null) return false;
    const index = this.towers.findIndex((t) => t.slot === this.selectedSlot);
    if (index < 0) return false;
    const tower=this.towers[index], base=CELL_TOWERS[tower.type];
    let invested=base.cost;
    for(let level=1;level<tower.level;level++) invested+=35+level*35;
    this.nutrients += Math.round(invested*.7);
    this.towers.splice(index,1); this.message=`${base.name} 회수`; this.emit(); return true;
  }

  startWaveNow() {
    if (this.phase !== "prep") return;
    const bonus = Math.round(Math.max(0, this.countdown) * GAME_BALANCE.earlyStartInterest);
    if (bonus > 0) {
      this.nutrients += bonus;
      this.floaters.push({ x: CORE.x - 40, y: CORE.y - 60, text: `조기 시작 +${bonus}`, color: "#f2c66d", life: 1.4, size: 15 });
    }
    this.countdown = 0;
    this.startWave();
    this.emit();
  }

  upgrade(id: OrganType, free = false) {
    const organ = this.organs[id];
    if (organ.level >= GAME_BALANCE.maxOrganLevel) return false;
    const cost = GAME_BALANCE.organUpgradeCosts[organ.level - 1];
    if (!free && this.nutrients < cost) return false;
    if (!free) this.nutrients -= cost;
    organ.level += 1;
    const p = ORGAN_POS[id];
    for (let i = 0; i < 22; i++) this.particles.push({ x: p.x, y: p.y, vx: Math.cos(i * .8) * 72, vy: Math.sin(i * .8) * 72, color: ORGANS[id].color, life: .85 });
    this.rings.push({ x: p.x, y: p.y, r: 10, maxR: 70, color: ORGANS[id].color, life: .6, width: 4 });
    this.message = `${ORGANS[id].name} Lv.${organ.level} 성장 완료`;
    this.emit();
    return true;
  }

  castAbility(id: OrganType) {
    if (this.phase !== "wave") { this.message = "웨이브 중에만 사용할 수 있습니다"; this.emit(); return false; }
    if (this.abilityCd[id] > 0) return false;
    const config = ORGANS[id];
    const p = ORGAN_POS[id];
    const level = this.organs[id].level;
    const range = config.range * GAME_BALANCE.levelRangeMultiplier[level - 1];
    this.abilityCd[id] = config.ability.cooldown;

    if (id === "lung") {
      // 심호흡: 사거리 내 정화 폭발 + 슬로우
      const burst = config.baseDamage * GAME_BALANCE.levelDamageMultiplier[level - 1] * this.permanentDamage * 2.4;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= range) { this.damageEnemy(e, burst, config.color); e.slow = Math.max(e.slow, config.ability.duration); }
      }
      this.rings.push({ x: p.x, y: p.y, r: 12, maxR: range, color: config.color, life: .7, width: 6 });
      this.strain.lung = Math.max(0, this.strain.lung - 45);
    } else if (id === "liver") {
      // 해독: 사거리 내 독 도트
      const dps = config.baseDamage * GAME_BALANCE.levelDamageMultiplier[level - 1] * this.permanentDamage * 0.9;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= range) { e.poison = config.ability.duration; e.poisonDps = dps; }
      }
      this.rings.push({ x: p.x, y: p.y, r: 12, maxR: range, color: "#c8ff43", life: .7, width: 6 });
      this.strain.liver = Math.max(0, this.strain.liver - 50);
    } else if (id === "heart") {
      // 혈류 조절: 전신 혈류를 늦춰 위기 대응 시간을 확보
      this.adrenaline = config.ability.duration;
      this.strain.heart = Math.max(0, this.strain.heart - 38);
      for (const t of TYPES) this.rings.push({ x: ORGAN_POS[t].x, y: ORGAN_POS[t].y, r: 8, maxR: 46, color: config.color, life: .5, width: 4 });
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.message = `${config.name} · ${config.ability.name}!`;
    this.emit();
    return true;
  }

  chooseCard(id: string) {
    if (this.phase !== "cards") return;
    if (id === "exercise") this.permanentDamage += GAME_BALANCE.damagePermanentStep;
    if (id === "sleep") this.life = Math.min(GAME_BALANCE.maxLife, this.life + 3);
    if (id === "checkup") {
      const min = Math.min(...TYPES.map((type) => this.organs[type].level));
      const target = TYPES.find((type) => this.organs[type].level === min && min < GAME_BALANCE.maxOrganLevel);
      if (target) this.upgrade(target, true); else this.nutrients += 120;
    }
    if (id === "vitamin") this.abilityCd = { lung: 0, liver: 0, heart: 0 };
    if (id === "energy") this.next.attackSpeed = 1.35;
    if (id === "snack") { this.nutrients += 130; this.next.extraEnemies.push("sugar", "sugar", "sugar"); }
    if (id === "allnight") { this.upgrade(this.selected, true); this.life = Math.max(0, this.life - 2); }
    if (id === "drinks") { this.nutrients += 180; this.next.extraEnemies.push("alcohol", "alcohol"); }
    if (id === "meditation") this.next.enemySpeed = .82;
    if (id === "walk") { this.life = Math.min(GAME_BALANCE.maxLife, this.life + 1); this.nutrients += 60; }
    if (this.life <= 0) { this.phase = "defeat"; this.message = "몸이 버티지 못했습니다."; this.emit(); return; }
    this.wave += 1;
    this.phase = "prep";
    this.countdown = GAME_BALANCE.prepSeconds;
    const w = WAVES[this.wave - 1];
    this.message = `${w.clock} ${w.label} 대비`;
    this.cards = [];
    this.emit();
  }

  private onPointer = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 1000 / rect.width;
    const y = (event.clientY - rect.top) * 600 / rect.height;
    for (let i=0;i<TOWER_SLOTS.length;i++) {
      const p=TOWER_SLOTS[i];
      if (Math.hypot(x-p.x,y-p.y)<38) { this.selectedSlot=i; this.emit(); return; }
    }
    for (const id of TYPES) {
      const p = ORGAN_POS[id];
      if (Math.hypot(x - p.x, y - p.y) < 52) { this.selected = id; this.selectedSlot = null; this.emit(); break; }
    }
  };

  private loop = (now: number) => {
    const raw = (now - this.last) / 1000 || 0;
    this.last = now;
    const active = !this.paused && this.phase !== "cards" && this.phase !== "victory" && this.phase !== "defeat";
    if (active) {
      // 배속: 큰 프레임을 잘게 나눠 시뮬레이션 안정성 유지
      const total = Math.min(.05, raw) * this.speed;
      let remaining = total;
      while (remaining > 0) { const step = Math.min(.02, remaining); this.update(step); remaining -= step; }
    }
    this.draw();
    this.uiTick += raw;
    if (this.uiTick > .12) { this.uiTick = 0; this.emit(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.adrenaline = Math.max(0, this.adrenaline - dt);
    for (const t of TYPES) this.abilityCd[t] = Math.max(0, this.abilityCd[t] - dt);
    for (const tower of this.towers) tower.attackAnim = Math.max(0, tower.attackAnim - dt);
    if (this.combo > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

    if (this.phase === "prep") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startWave();
    } else if (this.phase === "wave") {
      this.spawnClock += dt;
      while (this.queue.length && this.spawnClock >= this.queue[0].at) this.spawn(this.queue.shift()!.type);
      this.moveEnemies(dt);
      this.applyStatuses(dt);
      this.updatePhysiology(dt);
      this.attackTowers(dt);
      this.attack(dt);
      this.moveProjectiles(dt);
      if (!this.queue.length && !this.enemies.length) this.finishWave();
    }
    for (const f of this.floaters) { f.y -= 28 * dt; f.life -= dt; }
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt; }
    for (const t of this.tracers) t.life -= dt;
    for (const r of this.rings) { r.r += (r.maxR - r.r) * Math.min(1, dt * 7); r.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private startWave() {
    const config = WAVES[this.wave - 1];
    this.queue = [];
    for (const group of config.groups) {
      let at = group.delay ?? .2;
      for (let i = 0; i < group.count; i++) { this.queue.push({ type: group.type, at }); at += group.spawnInterval; }
    }
    let extraAt = (this.queue.at(-1)?.at ?? 0) + .5;
    for (const type of this.next.extraEnemies) { this.queue.push({ type, at: extraAt }); extraAt += .4; }
    this.queue.sort((a, b) => a.at - b.at);
    this.spawnClock = 0;
    this.phase = "wave";
    this.message = config.groups.some((g) => ENEMIES[g.type].boss) ? `⚠ ${config.label}` : `${config.clock} · ${config.label}`;
  }

  private spawn(type: EnemyType) {
    const base = ENEMIES[type];
    const scale = base.boss ? 1 + (this.wave - 1) * .05 : 1 + (this.wave - 1) * .12;
    const hp = base.maxHp * scale;
    this.enemies.push({
      id: ++this.enemyId, type, hp, maxHp: hp,
      speed: base.speed * (1 + (this.wave - 1) * .02) * this.next.enemySpeed,
      path: 0, x: PATH[0].x, y: PATH[0].y, hit: 0, dead: 0, slow: 0, poison: 0, poisonDps: 0, regenClock: 0,
    });
  }

  private moveEnemies(dt: number) {
    for (const enemy of this.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.slow = Math.max(0, enemy.slow - dt);
      const base = ENEMIES[enemy.type];
      const slowFactor = enemy.slow > 0 ? .45 : 1;
      const sprintFactor = base.sprint && Math.sin(this.elapsed * 1.7) > .72 ? 1.7 : 1;
      const flowFactor = this.adrenaline > 0 ? .48 : 1;
      let move = enemy.speed * dt * slowFactor * sprintFactor * flowFactor;
      while (move > 0 && enemy.path < PATH.length - 1) {
        const target = PATH[enemy.path + 1], dx = target.x - enemy.x, dy = target.y - enemy.y, dist = Math.hypot(dx, dy);
        if (move >= dist) { enemy.x = target.x; enemy.y = target.y; enemy.path++; move -= dist; }
        else { enemy.x += dx / dist * move; enemy.y += dy / dist * move; move = 0; }
      }
      if (enemy.path >= PATH.length - 1) {
        this.life = Math.max(0, this.life - base.lifeDamage);
        enemy.dead = 1; this.flash = .35; this.shake = .3; this.combo = 0;
        this.floaters.push({ x: CORE.x - 30, y: CORE.y - 40, text: `-${base.lifeDamage} 생명`, color: "#ff4364", life: 1, size: 16 });
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.life <= 0) { this.phase = "defeat"; this.message = "몸이 버티지 못했습니다."; }
  }

  private updatePhysiology(dt: number) {
    let lungThreat = 0, liverThreat = 0, heartThreat = 0;
    for (const enemy of this.enemies) {
      if (enemy.type === "dust") lungThreat += .55;
      if (enemy.type === "stress") { lungThreat += .08; heartThreat += .2; }
      if (enemy.type === "alcohol") liverThreat += .6;
      if (enemy.type === "sugar") liverThreat += .34;
      if (enemy.type === "caffeine") heartThreat += .72;
      if (enemy.type === "fatigue") heartThreat += .62;
      if (enemy.type === "overwork") heartThreat += 1.1;
    }
    const threats: Record<OrganType, number> = { lung: lungThreat, liver: liverThreat, heart: heartThreat };
    for (const id of TYPES) {
      const recovery = threats[id] === 0 ? 2.6 : .28;
      this.strain[id] = Math.max(0, Math.min(100, this.strain[id] + (threats[id] - recovery) * dt));
    }
    this.overloadTick -= dt;
    if (this.overloadTick <= 0) {
      this.overloadTick = 1;
      const overloaded = TYPES.filter((id) => this.strain[id] >= 100);
      if (overloaded.length) {
        this.life = Math.max(0, this.life - overloaded.length);
        this.flash = .18; this.shake = .16;
        this.message = `${overloaded.map((id) => ORGANS[id].name).join("·")} 과부하!`;
      }
    }
  }

  private applyStatuses(dt: number) {
    for (const enemy of this.enemies) {
      // 독 도트
      if (enemy.poison > 0) {
        enemy.poison -= dt;
        this.damageEnemy(enemy, enemy.poisonDps * dt, "#c8ff43", true);
      }
      // 자가 회복 (만성피로)
      const base = ENEMIES[enemy.type];
      if (base.regen && enemy.hp > 0 && enemy.poison <= 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + base.regen * dt);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private progress(e: Enemy): number {
    const next = PATH[Math.min(e.path + 1, PATH.length - 1)];
    return e.path * 10000 - Math.hypot(next.x - e.x, next.y - e.y);
  }

  private pickTarget(list: Enemy[]): Enemy {
    if (this.targetMode === "strong") return list.reduce((a, b) => (b.hp > a.hp ? b : a));
    if (this.targetMode === "last") return list.reduce((a, b) => (this.progress(b) < this.progress(a) ? b : a));
    return list.reduce((a, b) => (this.progress(b) > this.progress(a) ? b : a));
  }

  private towerSynergy(tower: PlacedTower) {
    const config=CELL_TOWERS[tower.type], p=TOWER_SLOTS[tower.slot];
    const neighbors=this.towers.filter((other)=>other.id!==tower.id&&Math.hypot(TOWER_SLOTS[other.slot].x-p.x,TOWER_SLOTS[other.slot].y-p.y)<185);
    const families=new Set(neighbors.map((t)=>CELL_TOWERS[t.type].family));
    return {
      speed: families.has("heart")&&config.family!=="heart" ? 1.25 : 1,
      damage: families.has("liver")&&config.family==="lung" ? 1.2 : 1,
      control: families.has("lung")&&config.family==="heart",
    };
  }

  private attackTowers(dt:number) {
    for (const tower of this.towers) {
      tower.cooldown-=dt; if(tower.cooldown>0)continue;
      const config=CELL_TOWERS[tower.type], p=TOWER_SLOTS[tower.slot], synergy=this.towerSynergy(tower);
      const levelMult=1+(tower.level-1)*.45;
      const range=config.range*(1+(tower.level-1)*.08)*(tower.branch==="utility"?1.18:1);
      const list=this.enemies.filter((e)=>Math.hypot(e.x-p.x,e.y-p.y)<=range);
      if(!list.length)continue;
      const target=this.pickTarget(list);
      let damage=config.damage*levelMult*synergy.damage*(tower.branch==="power"?1.35:1);
      if(config.bonusAgainst===target.type)damage*=config.bonusMultiplier??1;
      const victims=config.splash?this.enemies.filter((e)=>Math.hypot(e.x-target.x,e.y-target.y)<=config.splash!):[target];
      for(const victim of victims){
        this.damageEnemy(victim,damage*(victim===target?1:.58),config.color);
        if(tower.type==="oxygen")victim.slow=Math.max(victim.slow,tower.branch==="utility"?2.5:1.2);
        if(tower.type==="enzyme"){victim.poison=Math.max(victim.poison,2.5);victim.poisonDps=Math.max(victim.poisonDps,damage*.35)}
        if(tower.type==="platelet"||synergy.control)victim.slow=Math.max(victim.slow,tower.branch==="utility"?2.2:.8);
      }
      this.tracers.push({x:p.x,y:p.y,tx:target.x,ty:target.y,color:config.color,life:.16});
      if(config.splash)this.rings.push({x:target.x,y:target.y,r:5,maxR:config.splash,color:config.color,life:.3,width:2});
      tower.attackAnim=.48;
      tower.cooldown=1/(config.attackSpeed*synergy.speed*(tower.branch==="utility"?1.12:1));
    }
    this.enemies=this.enemies.filter((e)=>!e.dead);
  }

  private attack(dt: number) {
    for (const id of TYPES) {
      const config = ORGANS[id], state = this.organs[id], p = ORGAN_POS[id];
      this.organCooldown[id] -= dt;
      if (this.organCooldown[id] > 0) continue;
      const range = config.range * GAME_BALANCE.levelRangeMultiplier[state.level - 1];
      const inRange = this.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= range);
      if (!inRange.length) continue;
      const target = this.pickTarget(inRange);
      const damage = config.baseDamage * GAME_BALANCE.levelDamageMultiplier[state.level - 1] * this.permanentDamage * (config.bonusAgainst === target.type ? config.bonusMultiplier! : 1);
      this.projectiles.push({ x: p.x, y: p.y, tx: target.x, ty: target.y, target: target.id, organ: id, damage, color: config.color, splash: config.splash || 0, life: .5 });
      this.tracers.push({ x: p.x, y: p.y, tx: target.x, ty: target.y, color: config.color, life: .12 });
      const strainMult = this.strain[id] > 70 ? .62 : 1;
      this.organCooldown[id] = 1 / (config.baseAttackSpeed * GAME_BALANCE.levelSpeedMultiplier[state.level - 1] * this.next.attackSpeed * strainMult);
    }
  }

  private moveProjectiles(dt: number) {
    for (const shot of this.projectiles) {
      const enemy = this.enemies.find((e) => e.id === shot.target);
      if (enemy) { shot.tx = enemy.x; shot.ty = enemy.y; }
      const dx = shot.tx - shot.x, dy = shot.ty - shot.y, dist = Math.hypot(dx, dy);
      const move = 620 * dt;
      if (dist < move || shot.life <= 0) { if (enemy) this.impact(enemy, shot.damage, shot); shot.life = -1; }
      else { shot.x += dx / dist * move; shot.y += dy / dist * move; shot.life -= dt; }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private impact(enemy: Enemy, damage: number, shot: Projectile) {
    const victims = shot.splash ? this.enemies.filter((e) => Math.hypot(e.x - enemy.x, e.y - enemy.y) <= shot.splash) : [enemy];
    if (shot.splash) this.rings.push({ x: enemy.x, y: enemy.y, r: 6, maxR: shot.splash, color: shot.color, life: .32, width: 3 });
    for (const victim of victims) {
      const dealt = victim === enemy ? damage : damage * .6;
      this.damageEnemy(victim, dealt, shot.color);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private damageEnemy(enemy: Enemy, dealt: number, color: string, silent = false) {
    if (enemy.dead) return;
    enemy.hp -= dealt; enemy.hit = .12;
    if (!silent) this.floaters.push({ x: enemy.x, y: enemy.y - 20, text: `${Math.round(dealt)}`, color, life: .6, size: 15 });
    if (enemy.hp <= 0) {
      enemy.dead = 1; this.kills++;
      this.combo++; this.comboTimer = 3.2; this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = Math.min(GAME_BALANCE.comboMax, 1 + Math.floor(this.combo / GAME_BALANCE.comboStep));
      const reward = Math.round(ENEMIES[enemy.type].reward * mult);
      this.nutrients += reward;
      this.floaters.push({ x: enemy.x, y: enemy.y - 34, text: mult > 1 ? `+${reward} ×${mult}` : `+${reward}`, color: mult > 1 ? "#f2c66d" : "#80e0a7", life: .8, size: mult > 1 ? 17 : 13 });
      const n = ENEMIES[enemy.type].boss ? 22 : 10;
      for (let i = 0; i < n; i++) this.particles.push({ x: enemy.x, y: enemy.y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .5) * 150, color: ENEMIES[enemy.type].color, life: .65 });
      if (ENEMIES[enemy.type].boss) { this.shake = .35; this.rings.push({ x: enemy.x, y: enemy.y, r: 10, maxR: 120, color: ENEMIES[enemy.type].color, life: .8, width: 5 }); }
    }
  }

  private finishWave() {
    this.next = { attackSpeed: 1, enemySpeed: 1, extraEnemies: [] };
    this.adrenaline = 0;
    if (this.wave === WAVES.length) { this.phase = "victory"; this.message = "오늘도 살아남았습니다."; }
    else {
      this.phase = "cards";
      const pool = [...HABIT_CARDS].sort(() => Math.random() - .5);
      this.cards = pool.slice(0, 3);
      this.message = "생활 습관을 하나 선택하세요";
    }
    this.emit();
  }

  private getSynergyNames() {
    const found=new Set<string>();
    for(const tower of this.towers){
      const family=CELL_TOWERS[tower.type].family,p=TOWER_SLOTS[tower.slot];
      for(const other of this.towers){
        if(other.id===tower.id||Math.hypot(TOWER_SLOTS[other.slot].x-p.x,TOWER_SLOTS[other.slot].y-p.y)>=185)continue;
        const pair=[family,CELL_TOWERS[other.type].family].sort().join("-");
        if(pair==="heart-lung")found.add("심폐 순환 · 공속↑");
        if(pair==="liver-lung")found.add("전신 정화 · 피해↑");
        if(pair==="heart-liver")found.add("응고 해독 · 제어↑");
      }
    }
    return [...found];
  }

  private emit() {
    const w = WAVES[Math.min(this.wave - 1, WAVES.length - 1)];
    const abilities = {} as HudState["abilities"];
    for (const id of TYPES) {
      const cd = this.abilityCd[id], total = ORGANS[id].ability.cooldown;
      abilities[id] = { id: ORGANS[id].ability.id, cooldown: cd, ready: cd <= 0, active: id === "heart" ? this.adrenaline : 0 };
    }
    const oxygen = Math.max(0, Math.min(100, 100 - this.strain.lung * .78));
    const toxin = Math.max(0, Math.min(100, this.strain.liver));
    const pulse = Math.max(55, 68 + this.strain.heart * .82 - (this.adrenaline > 0 ? 24 : 0));
    this.onHud({
      phase: this.phase, wave: this.wave, totalWaves: WAVES.length, life: this.life, maxLife: GAME_BALANCE.maxLife,
      nutrients: Math.floor(this.nutrients), elapsed: this.elapsed, remaining: this.enemies.length + this.queue.length,
      countdown: Math.max(0, this.countdown), kills: this.kills, combo: this.combo, bestCombo: this.bestCombo,
      speed: this.speed, targetMode: this.targetMode, selected: this.selected, organs: structuredClone(this.organs),
      abilities, physiology: { oxygen, toxin, pulse, strain: { ...this.strain } },
      towers: this.towers.map(({id,type,slot,level,branch})=>({id,type,slot,level,branch})),
      selectedSlot:this.selectedSlot, synergies:this.getSynergyNames(),
      cards: this.cards, message: this.message, clock: w.clock, flavor: w.flavor,
    });
  }

  // ── 렌더링 ─────────────────────────────────────────
  private draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, 1000, 600);
    if (this.shake > 0) c.translate((Math.random() - .5) * 10, (Math.random() - .5) * 10);
    this.drawBody(c);
    this.drawVessels(c);
    this.drawTowerSlots(c);
    this.drawCore(c);
    this.drawOrgans(c);
    for (const t of this.tracers) { c.globalAlpha = Math.max(0, t.life / .12) * .8; c.strokeStyle = t.color; c.lineWidth = 2.5; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.tx, t.ty); c.stroke(); } c.globalAlpha = 1;
    for (const r of this.rings) { c.globalAlpha = Math.max(0, r.life); c.strokeStyle = r.color; c.lineWidth = r.width; c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke(); } c.globalAlpha = 1;
    for (const enemy of this.enemies) this.drawEnemy(c, enemy);
    for (const shot of this.projectiles) { c.beginPath(); c.arc(shot.x, shot.y, shot.organ === "lung" ? 9 : shot.organ === "liver" ? 7 : 5, 0, Math.PI * 2); c.fillStyle = shot.color; c.shadowColor = shot.color; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0; }
    for (const p of this.particles) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.fillRect(p.x, p.y, 4, 4); } c.globalAlpha = 1;
    for (const f of this.floaters) { c.globalAlpha = Math.min(1, f.life * 2.4); c.fillStyle = f.color; c.font = `800 ${f.size}px sans-serif`; c.textAlign = "center"; c.fillText(f.text, f.x, f.y); } c.globalAlpha = 1; c.textAlign = "start";
    if (this.adrenaline > 0) { c.strokeStyle = `rgba(78,229,225,${.25 + Math.sin(this.elapsed * 6) * .15})`; c.lineWidth = 6; c.strokeRect(3, 3, 994, 594); }
    if (this.flash > 0) { c.fillStyle = `rgba(255,35,68,${this.flash * .45})`; c.fillRect(0, 0, 1000, 600); }
    if (this.combo >= GAME_BALANCE.comboStep) { c.fillStyle = "#f2c66d"; c.font = "900 22px sans-serif"; c.textAlign = "right"; c.fillText(`${this.combo} COMBO`, 980, 40); c.textAlign = "start"; }
    if (this.paused) { c.fillStyle = "rgba(8,9,16,.62)"; c.fillRect(0, 0, 1000, 600); c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "800 34px sans-serif"; c.fillText("일시 정지", 500, 292); c.font = "15px sans-serif"; c.fillStyle = "#aeb4c2"; c.fillText("몸도 가끔은 쉬어야 합니다", 500, 325); c.textAlign = "start"; }
    c.restore();
  }

  private path(c: CanvasRenderingContext2D) { c.beginPath(); c.moveTo(PATH[0].x, PATH[0].y); for (let i = 1; i < PATH.length; i++) c.lineTo(PATH[i].x, PATH[i].y); }
  private drawTowerSlots(c:CanvasRenderingContext2D){
    for(let i=0;i<TOWER_SLOTS.length;i++){
      const p=TOWER_SLOTS[i],tower=this.towers.find((t)=>t.slot===i),selected=this.selectedSlot===i;
      c.beginPath();c.arc(p.x,p.y,selected?31:27,0,Math.PI*2);c.fillStyle=tower?"rgba(8,13,13,.72)":"rgba(255,255,255,.07)";c.fill();
      c.setLineDash(tower?[]:[5,5]);c.strokeStyle=selected?"#d8ff3e":tower?CELL_TOWERS[tower.type].color:"rgba(255,220,225,.42)";c.lineWidth=selected?3:1.5;c.stroke();c.setLineDash([]);
      if(!tower){c.fillStyle=selected?"#d8ff3e":"rgba(255,255,255,.55)";c.font="900 24px sans-serif";c.textAlign="center";c.fillText("+",p.x,p.y+8);c.textAlign="start";continue}
      this.drawTowerSprite(c,tower,p);
      c.fillStyle="#fff";c.font="900 8px sans-serif";c.textAlign="center";c.fillText(`LV${tower.level}`,p.x,p.y+38);c.textAlign="start";
    }
    for(const tower of this.towers){
      const p=TOWER_SLOTS[tower.slot],config=CELL_TOWERS[tower.type];
      for(const other of this.towers){
        if(other.id<=tower.id)continue;const op=TOWER_SLOTS[other.slot],oc=CELL_TOWERS[other.type];
        if(config.family!==oc.family&&Math.hypot(op.x-p.x,op.y-p.y)<185){c.strokeStyle="rgba(216,255,62,.28)";c.lineWidth=2;c.setLineDash([3,6]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(op.x,op.y);c.stroke();c.setLineDash([])}
      }
    }
  }
  private drawTowerSprite(c:CanvasRenderingContext2D,tower:PlacedTower,p:Point){
    if(!this.guardianSprites.complete||!this.guardianSprites.naturalWidth)return;
    const family=CELL_TOWERS[tower.type].family,row=family==="lung"?0:family==="liver"?1:2;
    let frame=Math.floor(this.elapsed*2)%2;
    if(tower.attackAnim>.28)frame=2;else if(tower.attackAnim>0)frame=3;
    c.save();c.shadowColor=CELL_TOWERS[tower.type].color;c.shadowBlur=10;c.drawImage(this.guardianSprites,frame*362,row*362,362,362,p.x-35,p.y-43,70,70);c.restore();
  }
  private drawBody(c: CanvasRenderingContext2D) {
    const tissue = c.createRadialGradient(500, 270, 40, 500, 300, 650);
    tissue.addColorStop(0, "#6f2036"); tissue.addColorStop(.52, "#401526"); tissue.addColorStop(1, "#1d0d19");
    c.fillStyle = tissue; c.fillRect(0, 0, 1000, 600);
    c.save(); c.globalAlpha = .22;
    for (let i = 0; i < 70; i++) {
      const x = (i * 137) % 1030 - 15, y = (i * 83) % 620 - 10, r = 10 + (i % 5) * 4;
      c.beginPath(); c.arc(x, y, r + Math.sin(this.elapsed + i) * 1.2, 0, Math.PI * 2);
      c.fillStyle = i % 3 ? "#d95e78" : "#f09a9e"; c.fill();
      c.beginPath(); c.arc(x + 2, y - 1, r * .48, 0, Math.PI * 2); c.strokeStyle = "#ffb1b5"; c.lineWidth = 1; c.stroke();
    }
    c.restore();
    const vignette = c.createRadialGradient(500, 300, 250, 500, 300, 650);
    vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(6,2,9,.72)");
    c.fillStyle = vignette; c.fillRect(0, 0, 1000, 600);
    c.fillStyle = "rgba(255,214,217,.6)"; c.font = "800 10px sans-serif"; c.letterSpacing = "2px";
    c.fillText("BODY INTERIOR · CIRCULATORY DEFENSE", 24, 28);
    c.letterSpacing = "0px";
  }
  private drawVessels(c: CanvasRenderingContext2D) {
    c.lineCap = "round"; c.lineJoin = "round";
    const branches = [
      { color: "#37668b", width: 13, points: [[300,280],[310,110],[420,28]] },
      { color: "#37668b", width: 9, points: [[585,450],[650,550],[765,610]] },
      { color: "#7d2d45", width: 11, points: [[475,280],[500,125],[600,35]] },
      { color: "#37668b", width: 8, points: [[790,450],[865,525],[995,545]] },
      { color: "#7d2d45", width: 7, points: [[170,130],[110,260],[20,300]] },
    ];
    for (const branch of branches) {
      c.beginPath(); c.moveTo(branch.points[0][0], branch.points[0][1]);
      for (let i = 1; i < branch.points.length; i++) c.lineTo(branch.points[i][0], branch.points[i][1]);
      c.strokeStyle = "rgba(5,3,10,.28)"; c.lineWidth = branch.width + 8; c.stroke();
      c.strokeStyle = branch.color; c.lineWidth = branch.width; c.stroke();
      c.strokeStyle = "rgba(255,255,255,.11)"; c.lineWidth = 1.5; c.stroke();
    }
    c.strokeStyle = "rgba(8,3,11,.4)"; c.lineWidth = 58; this.path(c); c.stroke();
    c.strokeStyle = "#932e49"; c.lineWidth = 44; this.path(c); c.stroke();
    const blood = c.createLinearGradient(0, 0, 1000, 0); blood.addColorStop(0, "#ac3851"); blood.addColorStop(.55, "#7e2942"); blood.addColorStop(1, "#bd354f");
    c.strokeStyle = blood; c.lineWidth = 30; this.path(c); c.stroke();
    c.strokeStyle = "rgba(255,180,188,.24)"; c.lineWidth = 3; this.path(c); c.stroke();
    for (let i = 0; i < 12; i++) {
      const x = 42 + i * 82 + (this.elapsed * 18) % 82, y = 112 + Math.sin(i * 1.8) * 8;
      if (x < 165) { c.beginPath(); c.ellipse(x, y, 7, 3.5, -.2, 0, Math.PI * 2); c.fillStyle = "rgba(255,160,170,.45)"; c.fill(); }
    }
    c.fillStyle = "#e99aa3"; c.font = "800 11px sans-serif"; c.fillText("외부 침입", 24, 91);
    c.fillStyle = "#d78391"; c.font = "700 9px sans-serif"; c.fillText("기관지 혈관", 177, 245); c.fillText("간문맥", 475, 455); c.fillText("대동맥", 760, 405);
  }
  private drawCore(c: CanvasRenderingContext2D) {
    const beat = 1 + Math.sin(this.elapsed * 4) * .08;
    const frac = Math.max(0, this.life / GAME_BALANCE.maxLife);
    c.save(); c.translate(CORE.x, CORE.y); c.scale(beat, beat);
    c.beginPath(); c.arc(0, 0, 38, 0, Math.PI * 2); c.fillStyle = "rgba(255,70,96,.18)"; c.fill();
    c.beginPath(); c.arc(0, 0, 26, 0, Math.PI * 2); c.fillStyle = frac > .34 ? "#ff4967" : "#c62b45"; c.shadowColor = "#ff4967"; c.shadowBlur = 28; c.fill();
    c.shadowBlur = 0; c.strokeStyle = "#ffc0c8"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "#fff"; c.font = "18px serif"; c.textAlign = "center"; c.fillText("✦", 0, 6); c.restore(); c.textAlign = "start";
    // 코어 생명 게이지
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(CORE.x - 30, CORE.y + 42, 60, 6);
    c.fillStyle = frac > .34 ? "#80e0a7" : "#ff4364"; c.fillRect(CORE.x - 30, CORE.y + 42, 60 * frac, 6);
    c.fillStyle = "#ffc0c8"; c.font = "800 10px sans-serif"; c.textAlign = "center"; c.fillText("생명 코어", CORE.x, CORE.y - 48); c.textAlign = "start";
  }
  private drawOrgans(c: CanvasRenderingContext2D) {
    for (const id of TYPES) {
      const config = ORGANS[id], p = ORGAN_POS[id], level = this.organs[id].level, selected = this.selected === id;
      const range = config.range * GAME_BALANCE.levelRangeMultiplier[level - 1];
      if (selected) { c.beginPath(); c.arc(p.x, p.y, range, 0, Math.PI * 2); c.fillStyle = `${config.color}12`; c.fill(); c.setLineDash([7, 8]); c.strokeStyle = `${config.color}70`; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
      // 스킬 준비 완료 표시 링
      if (this.phase === "wave" && this.abilityCd[id] <= 0) {
        c.beginPath(); c.arc(p.x, p.y, 54, 0, Math.PI * 2); c.strokeStyle = `${config.color}${Math.sin(this.elapsed * 4) > 0 ? "cc" : "55"}`; c.lineWidth = 2; c.stroke();
      }
      c.save();
      c.translate(p.x, p.y);
      const pulse = 1 + Math.sin(this.elapsed * (id === "heart" ? 6 : 2.4)) * .035;
      c.scale(pulse * (1 + (level - 1) * .05), pulse * (1 + (level - 1) * .05));
      c.shadowColor = config.color; c.shadowBlur = selected ? 28 : 11;
      if (id === "lung") this.drawLung(c);
      if (id === "liver") this.drawLiver(c);
      if (id === "heart") this.drawHeart(c);
      c.restore(); c.shadowBlur = 0;
      c.fillStyle = "#fff"; c.font = "900 11px sans-serif"; c.textAlign = "center"; c.fillText(`${config.name} · LV ${level}`, p.x, p.y + 63); c.textAlign = "start";
    }
  }
  private drawLung(c: CanvasRenderingContext2D) {
    c.strokeStyle = "#d8fbf7"; c.lineWidth = 6; c.beginPath(); c.moveTo(0,-42); c.lineTo(0,-15); c.moveTo(0,-15); c.lineTo(-18,4); c.moveTo(0,-15); c.lineTo(18,4); c.stroke();
    const g = c.createLinearGradient(-35,-20,35,45); g.addColorStop(0,"#91f3ec"); g.addColorStop(1,"#35aaa9");
    c.fillStyle = g; c.strokeStyle = "#cafffb"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5,-18); c.bezierCurveTo(-42,-22,-52,12,-43,38); c.bezierCurveTo(-34,61,-8,43,-5,14); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(5,-18); c.bezierCurveTo(42,-22,52,12,43,38); c.bezierCurveTo(34,61,8,43,5,14); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = 2;
    for (const side of [-1,1]) for (let i=0;i<3;i++){c.beginPath();c.moveTo(side*8,i*11);c.lineTo(side*(25+i*5),10+i*9);c.stroke();}
  }
  private drawLiver(c: CanvasRenderingContext2D) {
    const g = c.createLinearGradient(-45,-25,45,35); g.addColorStop(0,"#d69a55"); g.addColorStop(1,"#774322");
    c.fillStyle=g;c.strokeStyle="#f4bd72";c.lineWidth=2;
    c.beginPath();c.moveTo(-47,-10);c.bezierCurveTo(-31,-44,35,-40,51,-8);c.bezierCurveTo(58,13,26,43,-12,40);c.bezierCurveTo(-45,38,-59,14,-47,-10);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(4,-31);c.bezierCurveTo(-2,-4,1,17,-9,37);c.strokeStyle="rgba(255,231,190,.42)";c.lineWidth=3;c.stroke();
    c.beginPath();c.arc(24,12,8,0,Math.PI*2);c.fillStyle="#c8ff43";c.shadowColor="#c8ff43";c.shadowBlur=12;c.fill();
  }
  private drawHeart(c: CanvasRenderingContext2D) {
    const g=c.createLinearGradient(-30,-30,30,45);g.addColorStop(0,"#ff8290");g.addColorStop(1,"#b51f43");
    c.fillStyle=g;c.strokeStyle="#ffc1c8";c.lineWidth=2;
    c.beginPath();c.moveTo(0,45);c.bezierCurveTo(-9,27,-45,3,-38,-20);c.bezierCurveTo(-32,-43,-6,-37,0,-20);c.bezierCurveTo(9,-43,38,-39,40,-16);c.bezierCurveTo(43,8,13,31,0,45);c.closePath();c.fill();c.stroke();
    c.strokeStyle="#ed6a7e";c.lineWidth=8;c.beginPath();c.moveTo(-9,-27);c.bezierCurveTo(-14,-49,-2,-53,2,-66);c.moveTo(11,-26);c.bezierCurveTo(18,-47,31,-42,34,-58);c.stroke();
    c.strokeStyle="rgba(255,225,228,.65)";c.lineWidth=2;c.beginPath();c.moveTo(-18,-12);c.bezierCurveTo(-6,-3,-10,10,6,20);c.stroke();
  }
  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy) {
    const config = ENEMIES[e.type], boss = !!config.boss, size = boss ? 31 : 20;
    c.save(); c.translate(e.x, e.y);
    // 상태이상 링
    if (e.slow > 0) { c.strokeStyle = "rgba(120,235,255,.85)"; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, size + 8, 0, Math.PI * 2); c.stroke(); }
    if (e.poison > 0) { c.strokeStyle = `rgba(200,255,67,${.5 + Math.sin(this.elapsed * 10) * .3})`; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, size + 4, 0, Math.PI * 2); c.stroke(); }
    c.rotate(Math.sin(this.elapsed * 2 + e.id) * .15); c.scale(e.hit ? 1.25 : 1, e.hit ? .8 : 1);
    c.strokeStyle=e.hit?"#fff":config.color;c.lineWidth=boss?6:3;
    const spikes=boss?14:e.type==="dust"?10:e.type==="caffeine"?6:8;
    c.beginPath();for(let i=0;i<spikes*2;i++){const a=i/(spikes*2)*Math.PI*2,r=i%2?size:size*1.38;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();
    c.fillStyle=e.hit?"#fff":config.color;c.shadowColor=config.color;c.shadowBlur=boss?22:8;c.fill();c.stroke();c.shadowBlur=0;
    c.fillStyle="#251424";c.beginPath();c.arc(-6,-2,boss?5:3,0,Math.PI*2);c.arc(6,-2,boss?5:3,0,Math.PI*2);c.fill();
    if(e.type==="alcohol"){c.strokeStyle="#fff1ba";c.lineWidth=3;c.beginPath();c.moveTo(-8,9);c.lineTo(8,9);c.stroke()}
    else {c.strokeStyle="#251424";c.lineWidth=2;c.beginPath();c.arc(0,7,7,0,Math.PI);c.stroke()}
    c.fillStyle = "#161823"; c.fillRect(-size, -size - 12, size * 2, 5);
    const hpFrac = Math.max(0, e.hp / e.maxHp);
    c.fillStyle = boss ? "#ff4364" : hpFrac > .4 ? "#80e0a7" : "#f2c66d"; c.fillRect(-size, -size - 12, size * 2 * hpFrac, 5);
    c.restore(); c.textAlign = "start";
  }
}
