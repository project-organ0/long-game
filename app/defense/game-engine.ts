import { ENEMIES, GAME_BALANCE, HABIT_CARDS, ORGANS, WAVES } from "./balance";
import type { EnemyType, GamePhase, HabitCard, HudState, NextWaveEffects, OrganState, OrganType } from "./types";

type Point = { x: number; y: number };
type Enemy = { id: number; type: EnemyType; hp: number; maxHp: number; speed: number; path: number; x: number; y: number; hit: number; dead: number };
type Projectile = { x: number; y: number; tx: number; ty: number; target: number; organ: OrganType; damage: number; color: string; splash: number; life: number };
type Floater = { x: number; y: number; text: string; color: string; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; color: string; life: number };
type Spawn = { type: EnemyType; at: number };

const PATH: Point[] = [{ x: -35, y: 130 }, { x: 170, y: 130 }, { x: 250, y: 280 }, { x: 475, y: 280 }, { x: 585, y: 450 }, { x: 790, y: 450 }, { x: 930, y: 310 }, { x: 1035, y: 310 }];
const ORGAN_POS: Record<OrganType, Point> = { lung: { x: 220, y: 185 }, liver: { x: 515, y: 385 }, heart: { x: 790, y: 300 } };
const TYPES: OrganType[] = ["lung", "liver", "heart"];

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

  constructor(private canvas: HTMLCanvasElement, private onHud: (hud: HudState) => void) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    this.ctx = ctx;
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
    this.drawBody(c);
    this.drawVessels(c);
    this.drawCore(c);
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
    c.save(); c.translate(945, 310); c.scale(beat, beat);
    c.beginPath(); c.arc(0, 0, 38, 0, Math.PI * 2); c.fillStyle = "rgba(255,70,96,.18)"; c.fill();
    c.beginPath(); c.arc(0, 0, 26, 0, Math.PI * 2); c.fillStyle = "#ff4967"; c.shadowColor = "#ff4967"; c.shadowBlur = 28; c.fill();
    c.shadowBlur = 0; c.strokeStyle = "#ffc0c8"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "#fff"; c.font = "18px serif"; c.textAlign = "center"; c.fillText("✦", 0, 6); c.restore(); c.textAlign = "start";
    c.fillStyle = "#ffc0c8"; c.font = "800 10px sans-serif"; c.fillText("생명 코어", 912, 262);
  }
  private drawOrgans(c: CanvasRenderingContext2D) {
    for (const id of TYPES) {
      const config = ORGANS[id], p = ORGAN_POS[id], level = this.organs[id].level, selected = this.selected === id;
      const range = config.range * GAME_BALANCE.levelRangeMultiplier[level - 1];
      if (selected) { c.beginPath(); c.arc(p.x, p.y, range, 0, Math.PI * 2); c.fillStyle = `${config.color}12`; c.fill(); c.setLineDash([7, 8]); c.strokeStyle = `${config.color}70`; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
      c.save();
      c.translate(p.x, p.y);
      const pulse = 1 + Math.sin(this.elapsed * (id === "heart" ? 6 : 2.4)) * .035;
      c.scale(pulse * (1 + (level - 1) * .08), pulse * (1 + (level - 1) * .08));
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
    const config = ENEMIES[e.type], boss = e.type === "overwork", size = boss ? 31 : 20;
    c.save(); c.translate(e.x, e.y); c.rotate(Math.sin(this.elapsed * 2 + e.id) * .15); c.scale(e.hit ? 1.25 : 1, e.hit ? .8 : 1);
    c.strokeStyle=e.hit?"#fff":config.color;c.lineWidth=boss?6:3;
    const spikes=boss?14:e.type==="dust"?10:8;
    c.beginPath();for(let i=0;i<spikes*2;i++){const a=i/(spikes*2)*Math.PI*2,r=i%2?size:size*1.38;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();
    c.fillStyle=e.hit?"#fff":config.color;c.shadowColor=config.color;c.shadowBlur=boss?22:8;c.fill();c.stroke();c.shadowBlur=0;
    c.fillStyle="#251424";c.beginPath();c.arc(-6,-2,boss?5:3,0,Math.PI*2);c.arc(6,-2,boss?5:3,0,Math.PI*2);c.fill();
    if(e.type==="alcohol"){c.strokeStyle="#fff1ba";c.lineWidth=3;c.beginPath();c.moveTo(-8,9);c.lineTo(8,9);c.stroke()}
    else {c.strokeStyle="#251424";c.lineWidth=2;c.beginPath();c.arc(0,7,7,0,Math.PI);c.stroke()}
    c.fillStyle = "#161823"; c.fillRect(-size, -size - 12, size * 2, 5); c.fillStyle = boss ? "#ff4364" : "#80e0a7"; c.fillRect(-size, -size - 12, size * 2 * Math.max(0, e.hp / e.maxHp), 5); c.restore(); c.textAlign = "start";
  }
}
