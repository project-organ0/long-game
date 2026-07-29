import { ENEMIES, GAME_BALANCE, HABIT_CARDS, ORGANS, WAVES } from "./balance";
import type { EnemyType, GamePhase, HabitCard, HudState, NextWaveEffects, OrganState, OrganType } from "./types";

type Point = { x: number; y: number };
type Enemy = { id: number; type: EnemyType; hp: number; maxHp: number; speed: number; path: number; x: number; y: number; hit: number; dead: number };
type Projectile = { x: number; y: number; tx: number; ty: number; target: number; organ: OrganType; damage: number; color: string; splash: number; life: number };
type Floater = { x: number; y: number; text: string; color: string; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; color: string; life: number };
type Spawn = { type: EnemyType; at: number };

const PATH: Point[] = [{ x: -35, y: 130 }, { x: 170, y: 130 }, { x: 250, y: 280 }, { x: 475, y: 280 }, { x: 585, y: 450 }, { x: 790, y: 450 }, { x: 930, y: 310 }, { x: 1035, y: 310 }];
const ORGAN_POS: Record<OrganType, Point> = { lung: { x: 210, y: 75 }, liver: { x: 510, y: 390 }, heart: { x: 805, y: 295 } };
const TYPES: OrganType[] = ["lung", "liver", "heart"];
const ORGAN_FORM: Record<OrganType, { col: number; row: number }> = {
  lung: { col: 0, row: 1 },
  liver: { col: 1, row: 1 },
  heart: { col: 3, row: 0 },
};

export class DefenseEngine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private uiTick = 0;
  private phase: GamePhase = "prep";
  private wave: number = 1;
  private life: number = GAME_BALANCE.initialLife;
  private nutrients: number = GAME_BALANCE.initialNutrients;
  private elapsed = 0;
  private countdown: number = GAME_BALANCE.prepSeconds;
  private kills = 0;
  private selected: OrganType = "heart";
  private paused = false;
  private permanentDamage = 1;
  private next: NextWaveEffects = { attackSpeed: 1, enemySpeed: 1, extraEnemies: [] };
  private organCooldown: Record<OrganType, number> = { lung: 0, liver: 0, heart: 0 };
  private organs: Record<OrganType, OrganState> = { lung: { id: "lung", level: 1 }, liver: { id: "liver", level: 1 }, heart: { id: "heart", level: 1 } };
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private queue: Spawn[] = [];
  private spawnClock = 0;
  private enemyId = 0;
  private cards: HabitCard[] = [];
  private message = "방어 준비";
  private flash = 0;
  private shake = 0;
  private organForms = new Image();

  constructor(private canvas: HTMLCanvasElement, private onHud: (hud: HudState) => void) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    this.ctx = ctx;
    this.organForms.src = "/art/player-forms.png";
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
  selectOrgan(id: OrganType) { this.selected = id; this.emit(); }

  upgrade(id: OrganType, free = false) {
    const organ = this.organs[id];
    if (organ.level >= 3) return false;
    const cost = GAME_BALANCE.organUpgradeCosts[organ.level - 1];
    if (!free && this.nutrients < cost) return false;
    if (!free) this.nutrients -= cost;
    organ.level += 1;
    const p = ORGAN_POS[id];
    for (let i = 0; i < 18; i++) this.particles.push({ x: p.x, y: p.y, vx: Math.cos(i * .9) * 65, vy: Math.sin(i * .9) * 65, color: ORGANS[id].color, life: .8 });
    this.message = `${ORGANS[id].name} Lv.${organ.level} 성장 완료`;
    this.emit();
    return true;
  }

  chooseCard(id: string) {
    if (this.phase !== "cards") return;
    if (id === "exercise") this.permanentDamage += GAME_BALANCE.damagePermanentStep;
    if (id === "sleep") this.life = Math.min(GAME_BALANCE.maxLife, this.life + 2);
    if (id === "checkup") {
      const min = Math.min(...TYPES.map((type) => this.organs[type].level));
      const target = TYPES.find((type) => this.organs[type].level === min && min < 3);
      target ? this.upgrade(target, true) : this.nutrients += 80;
    }
    if (id === "energy") this.next.attackSpeed = 1.3;
    if (id === "snack") { this.nutrients += 100; this.next.extraEnemies.push("stress", "dust", "stress"); }
    if (id === "allnight") { this.upgrade(this.selected, true); this.life = Math.max(0, this.life - 2); }
    if (id === "drinks") { this.nutrients += 150; this.next.extraEnemies.push("alcohol", "alcohol"); }
    if (id === "meditation") this.next.enemySpeed = .85;
    if (this.life <= 0) { this.phase = "defeat"; this.message = "몸이 버티지 못했습니다."; this.emit(); return; }
    this.wave += 1;
    this.phase = "prep";
    this.countdown = GAME_BALANCE.prepSeconds;
    this.message = `${WAVES[this.wave - 1].label} 대비`;
    this.cards = [];
    this.emit();
  }

  private onPointer = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 1000 / rect.width;
    const y = (event.clientY - rect.top) * 600 / rect.height;
    for (const id of TYPES) {
      const p = ORGAN_POS[id];
      if (Math.hypot(x - p.x, y - p.y) < 52) { this.selected = id; this.emit(); break; }
    }
  };

  private loop = (now: number) => {
    const dt = Math.min(.04, (now - this.last) / 1000 || 0);
    this.last = now;
    if (!this.paused && this.phase !== "cards" && this.phase !== "victory" && this.phase !== "defeat") this.update(dt);
    this.draw();
    this.uiTick += dt;
    if (this.uiTick > .2) { this.uiTick = 0; this.emit(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === "prep") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startWave();
    } else if (this.phase === "wave") {
      this.spawnClock += dt;
      while (this.queue.length && this.spawnClock >= this.queue[0].at) this.spawn(this.queue.shift()!.type);
      this.moveEnemies(dt);
      this.attack(dt);
      this.moveProjectiles(dt);
      if (!this.queue.length && !this.enemies.length) this.finishWave();
    }
    for (const f of this.floaters) { f.y -= 28 * dt; f.life -= dt; }
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private startWave() {
    const config = WAVES[this.wave - 1];
    this.queue = [];
    let at = .2;
    for (const group of config.groups) for (let i = 0; i < group.count; i++) { this.queue.push({ type: group.type, at }); at += group.spawnInterval; }
    for (const type of this.next.extraEnemies) { at += .35; this.queue.push({ type, at }); }
    this.queue.sort((a, b) => a.at - b.at);
    this.spawnClock = 0;
    this.phase = "wave";
    this.message = this.wave === 5 ? "⚠ 과로 보스 접근 중" : `WAVE ${this.wave} · ${config.label}`;
  }

  private spawn(type: EnemyType) {
    const base = ENEMIES[type];
    const scale = 1 + (this.wave - 1) * .14;
    this.enemies.push({ id: ++this.enemyId, type, hp: base.maxHp * scale, maxHp: base.maxHp * scale, speed: base.speed * (1 + (this.wave - 1) * .025) * this.next.enemySpeed, path: 0, x: PATH[0].x, y: PATH[0].y, hit: 0, dead: 0 });
  }

  private moveEnemies(dt: number) {
    for (const enemy of this.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      let move = enemy.speed * dt * (enemy.type === "overwork" && Math.sin(this.elapsed * 1.7) > .72 ? 1.7 : 1);
      while (move > 0 && enemy.path < PATH.length - 1) {
        const target = PATH[enemy.path + 1], dx = target.x - enemy.x, dy = target.y - enemy.y, dist = Math.hypot(dx, dy);
        if (move >= dist) { enemy.x = target.x; enemy.y = target.y; enemy.path++; move -= dist; }
        else { enemy.x += dx / dist * move; enemy.y += dy / dist * move; move = 0; }
      }
      if (enemy.path >= PATH.length - 1) {
        this.life = Math.max(0, this.life - ENEMIES[enemy.type].lifeDamage);
        enemy.dead = 1; this.flash = .35; this.shake = .3;
        this.floaters.push({ x: 910, y: 270, text: `-${ENEMIES[enemy.type].lifeDamage} 생명`, color: "#ff4364", life: 1 });
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.life <= 0) { this.phase = "defeat"; this.message = "몸이 버티지 못했습니다."; }
  }

  private attack(dt: number) {
    for (const id of TYPES) {
      const config = ORGANS[id], state = this.organs[id], p = ORGAN_POS[id];
      this.organCooldown[id] -= dt;
      if (this.organCooldown[id] > 0) continue;
      const range = config.range * GAME_BALANCE.levelRangeMultiplier[state.level - 1];
      const targets = this.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= range).sort((a, b) => b.path - a.path);
      if (!targets.length) continue;
      const target = targets[0];
      const damage = config.baseDamage * GAME_BALANCE.levelDamageMultiplier[state.level - 1] * this.permanentDamage * (config.bonusAgainst === target.type ? config.bonusMultiplier! : 1);
      this.projectiles.push({ x: p.x, y: p.y, tx: target.x, ty: target.y, target: target.id, organ: id, damage, color: config.color, splash: config.splash || 0, life: .45 });
      this.organCooldown[id] = 1 / (config.baseAttackSpeed * GAME_BALANCE.levelSpeedMultiplier[state.level - 1] * this.next.attackSpeed);
    }
  }

  private moveProjectiles(dt: number) {
    for (const shot of this.projectiles) {
      const enemy = this.enemies.find((e) => e.id === shot.target);
      if (enemy) { shot.tx = enemy.x; shot.ty = enemy.y; }
      const dx = shot.tx - shot.x, dy = shot.ty - shot.y, dist = Math.hypot(dx, dy);
      const move = 580 * dt;
      if (dist < move || shot.life <= 0) { if (enemy) this.hit(enemy, shot.damage, shot); shot.life = -1; }
      else { shot.x += dx / dist * move; shot.y += dy / dist * move; shot.life -= dt; }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private hit(enemy: Enemy, damage: number, shot: Projectile) {
    const victims = shot.splash ? this.enemies.filter((e) => Math.hypot(e.x - enemy.x, e.y - enemy.y) <= shot.splash) : [enemy];
    for (const victim of victims) {
      const dealt = victim === enemy ? damage : damage * .65;
      victim.hp -= dealt; victim.hit = .12;
      this.floaters.push({ x: victim.x, y: victim.y - 20, text: `${Math.round(dealt)}`, color: shot.color, life: .65 });
      if (victim.hp <= 0 && !victim.dead) {
        victim.dead = 1; this.kills++; this.nutrients += ENEMIES[victim.type].reward;
        for (let i = 0; i < 9; i++) this.particles.push({ x: victim.x, y: victim.y, vx: (Math.random() - .5) * 130, vy: (Math.random() - .5) * 130, color: ENEMIES[victim.type].color, life: .6 });
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private finishWave() {
    this.next = { attackSpeed: 1, enemySpeed: 1, extraEnemies: [] };
    if (this.wave === WAVES.length) { this.phase = "victory"; this.message = "오늘도 살아남았습니다."; }
    else {
      this.phase = "cards";
      const pool = [...HABIT_CARDS].sort(() => Math.random() - .5);
      this.cards = pool.slice(0, 3);
      this.message = "생활 습관을 하나 선택하세요";
    }
    this.emit();
  }

  private emit() {
    this.onHud({ phase: this.phase, wave: this.wave, life: this.life, nutrients: this.nutrients, elapsed: this.elapsed, remaining: this.enemies.length + this.queue.length, countdown: Math.max(0, this.countdown), kills: this.kills, selected: this.selected, organs: structuredClone(this.organs), cards: this.cards, message: this.message });
  }

  private draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, 1000, 600);
    if (this.shake > 0) c.translate((Math.random() - .5) * 10, (Math.random() - .5) * 10);
    const bg = c.createLinearGradient(0, 0, 1000, 600); bg.addColorStop(0, "#151928"); bg.addColorStop(1, "#201322"); c.fillStyle = bg; c.fillRect(0, 0, 1000, 600);
    c.strokeStyle = "rgba(255,255,255,.035)"; c.lineWidth = 1;
    for (let x = 20; x < 1000; x += 42) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 600); c.stroke(); }
    for (let y = 20; y < 600; y += 42) { c.beginPath(); c.moveTo(0, y); c.lineTo(1000, y); c.stroke(); }
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "rgba(238,108,127,.18)"; c.lineWidth = 54; this.path(c); c.stroke();
    c.strokeStyle = "#8f394d"; c.lineWidth = 30; this.path(c); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 2; this.path(c); c.stroke();
    c.fillStyle = "#77808d"; c.font = "700 12px sans-serif"; c.fillText("침투 입구", 22, 102); c.fillText("생명 코어", 900, 265);
    c.beginPath(); c.arc(945, 310, 34 + Math.sin(this.elapsed * 3) * 3, 0, Math.PI * 2); c.fillStyle = "#ff4364"; c.shadowColor = "#ff4364"; c.shadowBlur = 24; c.fill(); c.shadowBlur = 0; c.fillStyle = "#fff"; c.font = "22px serif"; c.textAlign = "center"; c.fillText("✦", 945, 318); c.textAlign = "start";
    this.drawOrgans(c);
    for (const enemy of this.enemies) this.drawEnemy(c, enemy);
    for (const shot of this.projectiles) { c.beginPath(); c.arc(shot.x, shot.y, shot.organ === "lung" ? 9 : 5, 0, Math.PI * 2); c.fillStyle = shot.color; c.shadowColor = shot.color; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0; }
    for (const p of this.particles) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.fillRect(p.x, p.y, 4, 4); } c.globalAlpha = 1;
    for (const f of this.floaters) { c.globalAlpha = Math.min(1, f.life * 2); c.fillStyle = f.color; c.font = "800 16px sans-serif"; c.textAlign = "center"; c.fillText(f.text, f.x, f.y); } c.globalAlpha = 1; c.textAlign = "start";
    if (this.flash > 0) { c.fillStyle = `rgba(255,35,68,${this.flash * .45})`; c.fillRect(0, 0, 1000, 600); }
    if (this.paused) { c.fillStyle = "rgba(8,9,16,.62)"; c.fillRect(0, 0, 1000, 600); c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "800 34px sans-serif"; c.fillText("일시 정지", 500, 292); c.font = "15px sans-serif"; c.fillStyle = "#aeb4c2"; c.fillText("몸도 가끔은 쉬어야 합니다", 500, 325); c.textAlign = "start"; }
    c.restore();
  }

  private path(c: CanvasRenderingContext2D) { c.beginPath(); c.moveTo(PATH[0].x, PATH[0].y); for (let i = 1; i < PATH.length; i++) c.lineTo(PATH[i].x, PATH[i].y); }
  private drawOrgans(c: CanvasRenderingContext2D) {
    for (const id of TYPES) {
      const config = ORGANS[id], p = ORGAN_POS[id], level = this.organs[id].level, selected = this.selected === id;
      const range = config.range * GAME_BALANCE.levelRangeMultiplier[level - 1];
      if (selected) { c.beginPath(); c.arc(p.x, p.y, range, 0, Math.PI * 2); c.fillStyle = `${config.color}12`; c.fill(); c.setLineDash([7, 8]); c.strokeStyle = `${config.color}70`; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
      c.beginPath(); c.ellipse(p.x, p.y + 31, 47 + level * 2, 17, 0, 0, Math.PI * 2); c.fillStyle = "rgba(4,8,9,.48)"; c.fill();
      c.save();
      c.translate(p.x, p.y);
      const pulse = 1 + Math.sin(this.elapsed * (id === "heart" ? 7 : 2.8)) * .018;
      c.scale(pulse, pulse);
      c.shadowColor = config.color; c.shadowBlur = selected ? 28 : 11;
      if (this.organForms.complete && this.organForms.naturalWidth) {
        const form = ORGAN_FORM[id];
        c.drawImage(this.organForms, form.col * 384, form.row * 512, 384, 512, -55 - level * 2, -76 - level * 3, 110 + level * 4, 147 + level * 6);
      } else {
        c.font = "42px serif"; c.textAlign = "center"; c.fillText(config.emoji, 0, 12);
      }
      c.restore(); c.shadowBlur = 0;
      c.fillStyle = "#fff"; c.font = "800 12px sans-serif"; c.textAlign = "center"; c.fillText(`${config.name} · LV ${level}`, p.x, p.y + 61); c.textAlign = "start";
    }
  }
  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy) {
    const config = ENEMIES[e.type], boss = e.type === "overwork", size = boss ? 31 : 20;
    c.save(); c.translate(e.x, e.y); c.scale(e.hit ? 1.25 : 1, e.hit ? .8 : 1);
    c.beginPath(); c.arc(0, 0, size, 0, Math.PI * 2); c.fillStyle = e.hit ? "#fff" : config.color; c.shadowColor = config.color; c.shadowBlur = boss ? 20 : 7; c.fill(); c.shadowBlur = 0;
    c.fillStyle = "#fff"; c.font = `${boss ? 24 : 16}px sans-serif`; c.textAlign = "center"; c.fillText(config.glyph, 0, 6);
    c.fillStyle = "#161823"; c.fillRect(-size, -size - 12, size * 2, 5); c.fillStyle = boss ? "#ff4364" : "#80e0a7"; c.fillRect(-size, -size - 12, size * 2 * Math.max(0, e.hp / e.maxHp), 5); c.restore(); c.textAlign = "start";
  }
}
