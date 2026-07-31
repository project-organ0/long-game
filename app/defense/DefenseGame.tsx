"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DefenseEngine } from "./game-engine";
import { CELL_TOWERS, GAME_BALANCE, ORGANS, WAVES } from "./balance";
import type { HudState, OrganType, TargetMode } from "./types";

const TYPES: OrganType[] = ["lung", "liver", "heart"];
const TARGET_LABEL: Record<TargetMode, string> = { first: "선두 우선", last: "후미 우선", strong: "최강 우선" };

// 개인 최고 기록 (localStorage 영속)
type BestRecord = { kills: number; combo: number; wave: number };
const BEST_KEY = "janggi-best";
function loadBest(): BestRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    return { kills: parsed.kills ?? 0, combo: parsed.combo ?? 0, wave: parsed.wave ?? 0 };
  } catch { return null; }
}
function saveBest(record: BestRecord) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(BEST_KEY, JSON.stringify(record)); } catch { /* 저장 불가 무시 */ }
}

const initialHud: HudState = {
  phase: "prep", wave: 1, totalWaves: WAVES.length, life: GAME_BALANCE.initialLife, maxLife: GAME_BALANCE.maxLife,
  nutrients: GAME_BALANCE.initialNutrients, elapsed: 0, remaining: 0, countdown: GAME_BALANCE.prepSeconds,
  kills: 0, combo: 0, bestCombo: 0, speed: 1, targetMode: "first", selected: "heart",
  organs: { lung: { id: "lung", level: 1 }, liver: { id: "liver", level: 1 }, heart: { id: "heart", level: 1 } },
  abilities: {
    lung: { id: "breath", cooldown: 0, ready: true, active: 0 },
    liver: { id: "detox", cooldown: 0, ready: true, active: 0 },
    heart: { id: "adrenaline", cooldown: 0, ready: true, active: 0 },
  },
  physiology: { oxygen: 100, toxin: 0, pulse: 68, strain: { lung: 0, liver: 0, heart: 0 } },
  towers: [], selectedSlot: 0, synergies: [],
  cards: [], message: "방어 준비", clock: WAVES[0].clock, flavor: WAVES[0].flavor,
};

export default function DefenseGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DefenseEngine | null>(null);
  const [hud, setHud] = useState(initialHud);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState<BestRecord | null>(() => loadBest());
  const bestRef = useRef<BestRecord | null>(best);
  const recordedRef = useRef(false);

  // 엔진 HUD 콜백: 상태 반영 + 게임 종료 시 최고 기록을 1회만 갱신
  const handleHud = useCallback((h: HudState) => {
    setHud(h);
    const over = h.phase === "victory" || h.phase === "defeat";
    if (over && !recordedRef.current) {
      recordedRef.current = true;
      const prev = bestRef.current;
      const merged: BestRecord = {
        kills: Math.max(prev?.kills ?? 0, h.kills),
        combo: Math.max(prev?.combo ?? 0, h.bestCombo),
        wave: Math.max(prev?.wave ?? 0, h.phase === "victory" ? WAVES.length : h.wave),
      };
      bestRef.current = merged;
      saveBest(merged);
      setBest(merged);
    } else if (!over) {
      recordedRef.current = false; // 재시작 대비
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new DefenseEngine(canvasRef.current, handleHud);
    engineRef.current = engine;
    return () => { engine.destroy(); engineRef.current = null; };
  }, [run, handleHud]);

  const selected = ORGANS[hud.selected];
  const selectedState = hud.organs[hud.selected];
  const selectedTower = hud.selectedSlot === null ? undefined : hud.towers.find((tower) => tower.slot === hud.selectedSlot);
  const selectedTowerConfig = selectedTower ? CELL_TOWERS[selectedTower.type] : undefined;
  const maxLevel = GAME_BALANCE.maxOrganLevel;
  const stats = useMemo(() => ({
    damage: Math.round(selected.baseDamage * GAME_BALANCE.levelDamageMultiplier[selectedState.level - 1]),
    speed: (selected.baseAttackSpeed * GAME_BALANCE.levelSpeedMultiplier[selectedState.level - 1]).toFixed(2),
    range: Math.round(selected.range * GAME_BALANCE.levelRangeMultiplier[selectedState.level - 1]),
  }), [selected, selectedState.level]);
  const cost = selectedState.level < maxLevel ? GAME_BALANCE.organUpgradeCosts[selectedState.level - 1] : 0;
  const time = `${String(Math.floor(hud.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(hud.elapsed % 60)).padStart(2, "0")}`;

  const restart = () => { setHud(initialHud); setPaused(false); setRun((n) => n + 1); };
  const pause = () => { engineRef.current?.togglePause(); setPaused((p) => !p); };
  const select = useCallback((id: OrganType) => engineRef.current?.selectOrgan(id), []);
  const cast = useCallback((id: OrganType) => engineRef.current?.castAbility(id), []);
  const setSpeed = (s: number) => engineRef.current?.setSpeed(s);
  const cycleTarget = () => engineRef.current?.cycleTargetMode();
  const startNow = () => engineRef.current?.startWaveNow();

  // 키보드 조작: Q/W/E 액티브 스킬, Space 웨이브 즉시 시작, 1/2/3 배속
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "q") cast("lung");
      else if (k === "w") cast("liver");
      else if (k === "e") cast("heart");
      else if (k === " ") { e.preventDefault(); startNow(); }
      else if (k === "1") setSpeed(1);
      else if (k === "2") setSpeed(2);
      else if (k === "3") setSpeed(3);
      else if (k === "p") pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cast]);

  return (
    <main className="game-shell">
      <header className="game-header">
        <div><Link href="/" className="back-link">← 처음으로</Link><h1>장기<span>전</span></h1></div>
        <p>오늘 하루 생존 프로토콜</p>
        <div className="speed-control" role="group" aria-label="게임 배속">
          {GAME_BALANCE.speedOptions.map((s) => (
            <button key={s} className={hud.speed === s ? "active" : ""} onClick={() => setSpeed(s)} aria-pressed={hud.speed === s}>{s}×</button>
          ))}
        </div>
        <button className="pause-button" onClick={pause} aria-label={paused ? "게임 재개" : "게임 일시정지"}>{paused ? "▶ 재개" : "Ⅱ 정지"}</button>
      </header>

      <section className="hud" aria-label="게임 상태">
        <div><small>시간대</small><strong className="clock">{hud.clock}<i>{hud.wave}/{hud.totalWaves}</i></strong></div>
        <div className={hud.life < 15 ? "hud-danger" : ""}><small>침입 포화</small><strong className="life">● {hud.maxLife - hud.life}<i>/{hud.maxLife}</i></strong></div>
        <div><small>영양분</small><strong className="nutrient">● {hud.nutrients}</strong></div>
        <div className={hud.physiology.oxygen < 45 ? "hud-danger" : ""}><small>산소</small><strong className="oxygen">{Math.round(hud.physiology.oxygen)}<i>%</i></strong></div>
        <div className={hud.physiology.toxin > 65 ? "hud-danger" : ""}><small>독소</small><strong className="toxin">{Math.round(hud.physiology.toxin)}<i>%</i></strong></div>
        <div className={hud.physiology.pulse > 125 ? "hud-danger" : ""}><small>심박</small><strong className="pulse">{Math.round(hud.physiology.pulse)}<i>BPM</i></strong></div>
        <div><small>남은 침입자</small><strong>{hud.remaining}</strong></div>
        <div><small>연속 처치</small><strong className="combo">{hud.combo > 0 ? `${hud.combo}×` : "—"}</strong></div>
        <div><small>생존 시간</small><strong>{time}</strong></div>
      </section>

      <div className="game-grid">
        <section className="arena-wrap">
          <div className={`wave-banner ${hud.phase}`}>
            <span>{hud.phase === "prep" ? `${Math.ceil(hud.countdown)}초 후 시작` : hud.phase === "wave" ? `${hud.clock} · WAVE ${hud.wave}` : "생활 습관 정비"}</span>
            <b>{hud.message}</b>
          </div>
          <canvas ref={canvasRef} width="1000" height="600" aria-label="장기전 게임 맵" role="img" />
          <p className="sr-only" role="status" aria-live="polite">{hud.message}</p>

          {hud.phase === "prep" && (
            <button className="start-now" onClick={startNow}>
              ▶ 웨이브 즉시 시작 <em>+{Math.round(hud.countdown * GAME_BALANCE.earlyStartInterest)} 영양분</em>
            </button>
          )}

          <div className="control-bar">
            <div className="ability-bar" role="group" aria-label="장기 액티브 스킬">
              {TYPES.map((id) => {
                const ab = hud.abilities[id];
                const config = ORGANS[id].ability;
                const pct = ab.ready ? 0 : Math.min(100, (ab.cooldown / config.cooldown) * 100);
                const hot = id === "lung" ? "Q" : id === "liver" ? "W" : "E";
                return (
                  <button key={id} className={`ability ${ab.ready ? "ready" : "cooling"} ${ab.active > 0 ? "on" : ""}`}
                    style={{ "--organ": ORGANS[id].color } as React.CSSProperties}
                    onClick={() => cast(id)} disabled={!ab.ready || hud.phase !== "wave"}
                    title={`${config.name} · ${config.description}`}>
                    <span className="ab-icon">{config.icon}</span>
                    <span className="ab-meta"><b>{config.name}</b><small>{ORGANS[id].name} · {hot}</small></span>
                    {!ab.ready && <span className="ab-cool" style={{ height: `${pct}%` }} />}
                    {!ab.ready && <span className="ab-num">{Math.ceil(ab.cooldown)}</span>}
                    {ab.active > 0 && <span className="ab-num on">{Math.ceil(ab.active)}s</span>}
                  </button>
                );
              })}
            </div>
            <button className="target-toggle" onClick={cycleTarget} title="타워 조준 우선순위">
              <small>조준</small><b>{TARGET_LABEL[hud.targetMode]}</b>
            </button>
          </div>

          <div className="organ-tabs">
            {TYPES.map((id) => (
              <button key={id} className={hud.selected === id ? "active" : ""} style={{ "--organ": ORGANS[id].color } as React.CSSProperties} onClick={() => select(id)}>
                <span className={`organ-avatar avatar-${id}`} /><b>{ORGANS[id].name}</b><small>LV {hud.organs[id].level}</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="organ-panel">
          {hud.selectedSlot !== null ? <div className="tower-panel">
            <div className="tower-panel-head">
              <small>배치 슬롯 {hud.selectedSlot + 1} · {selectedTower ? ORGANS[selectedTower.affinity].name : "지역"} 적성</small>
              <h2>{selectedTowerConfig ? selectedTowerConfig.name : "세포 타워 배치"}</h2>
              <p>{selectedTowerConfig ? selectedTowerConfig.role : "미분화 세포를 심고 위치에 맞춰 진화시키세요."}</p>
            </div>
            {!selectedTower ? <div className="tower-shop">
              <button onClick={()=>engineRef.current?.buildTower()} disabled={hud.nutrients<GAME_BALANCE.stemCost} style={{"--tower":CELL_TOWERS.stem.color} as React.CSSProperties}>
                <img className="tower-thumb-img" src="/art/cells-v2/cell-undifferentiated.png" alt="" />
                <span><b>미분화 세포 심기</b><small>어디서든 세 계열로 성장</small></span><em>● {GAME_BALANCE.stemCost}</em>
              </button>
            </div> : <>
              <div className="tower-portrait-img">
                <img src={selectedTower.level===1?"/art/cells-v2/cell-undifferentiated.png":`/art/cells-v2/cell-${selectedTower.type}-${selectedTower.level}.png`} alt="" />
                <span>LV {selectedTower.level}</span>
              </div>
              <div className="tower-stats">
                <p><span>공격력</span><b>{Math.round(selectedTowerConfig!.damage*(1+(selectedTower.level-1)*.45))}</b></p>
                <p><span>공격속도</span><b>{selectedTowerConfig!.attackSpeed}<small>/초</small></b></p>
                <p><span>사거리</span><b>{selectedTowerConfig!.range}</b></p>
              </div>
              {selectedTower.level===1 && <div className="evolution-actions">
                <small>진화 방향 선택 · 현재 위치는 {ORGANS[selectedTower.affinity].name} 적성</small>
                {TYPES.map((family)=>{
                  const preferred=family===selectedTower.affinity;
                  const evolveCost=preferred?GAME_BALANCE.differentiationCost:Math.round(GAME_BALANCE.differentiationCost*1.35);
                  return <button key={family} className={preferred?"preferred":""} disabled={hud.nutrients<evolveCost} onClick={()=>engineRef.current?.evolveTower(family)}>
                    <img src={`/art/cells-v2/cell-${family}-2.png`} alt="" />
                    <span><b>{CELL_TOWERS[family].name}</b><small>{preferred?"지역 적합 · 비용 할인":CELL_TOWERS[family].role}</small></span><em>● {evolveCost}</em>
                  </button>;
                })}
              </div>}
              {selectedTower.level===2 && <div className="evolution-actions">
                <small>전문화 가능 · 머리 위 ↑ 표시를 눌러도 열립니다</small>
                <button className="preferred" disabled={hud.nutrients<(selectedTower.affinity===selectedTower.type?GAME_BALANCE.specializationCost:Math.round(GAME_BALANCE.specializationCost*1.35))} onClick={()=>engineRef.current?.evolveTower(selectedTower.type as OrganType)}>
                  <img src={`/art/cells-v2/cell-${selectedTower.type}-3.png`} alt="" />
                  <span><b>{selectedTower.type==="lung"?"폐포 청소부":selectedTower.type==="liver"?"해독 효소 기술자":"혈소판 방위대"}</b><small>최종 전문 세포로 진화</small></span>
                  <em>● {selectedTower.affinity===selectedTower.type?GAME_BALANCE.specializationCost:Math.round(GAME_BALANCE.specializationCost*1.35)}</em>
                </button>
              </div>}
              {selectedTower.level>=3 && <p className="tower-max">MAX · 전문 분화 완료</p>}
              <button className="sell-tower" onClick={()=>engineRef.current?.sellTower()}>타워 회수 · 70% 환급</button>
            </>}
            <div className="synergy-box">
              <small>활성 조합</small>
              {hud.synergies.length ? hud.synergies.map((name)=><b key={name}>✦ {name}</b>) : <p>서로 다른 장기 계열을 가까이 배치하세요.</p>}
            </div>
            <button className="back-organ" onClick={()=>select(hud.selected)}>← 장기 본부 보기</button>
          </div> : <>
          <div className="panel-heading"><span className={`organ-avatar avatar-${hud.selected}`} style={{ backgroundColor: selected.color }} /><div><small>선택 장기 수호자</small><h2>{selected.name} <i>LV {selectedState.level}</i></h2></div></div>
          <p className="role">{selected.role}</p>
          <div className={`strain-meter ${hud.physiology.strain[hud.selected] > 70 ? "danger" : ""}`}>
            <span><small>장기 부담도</small><b>{Math.round(hud.physiology.strain[hud.selected])}%</b></span>
            <i><u style={{ width: `${hud.physiology.strain[hud.selected]}%`, background: selected.color }} /></i>
            <p>{hud.physiology.strain[hud.selected] > 70 ? "과부하 · 공격 효율이 감소합니다" : "안정 · 정상적으로 방어 중"}</p>
          </div>
          <div className="stats">
            <div><span>스킬 위력</span><b>{stats.damage}</b></div>
            <div><span>지원 효율</span><b>{stats.speed}<small>/초</small></b></div>
            <div><span>영향 범위</span><b>{stats.range}</b></div>
          </div>
          <div className="special"><small>SPECIAL</small><p>{selected.bonusAgainst === "dust" ? "미세먼지 특화 · 주변 광역 정화" : selected.bonusAgainst === "toxin" ? "독소 특화 · 지속 해독 피해" : "바이러스 특화 · 초고속 응고 공격"}</p></div>
          <div className="ability-info"><small>액티브 · {selected.ability.name}</small><p>{selected.ability.description}</p></div>
          <button className="upgrade" disabled={selectedState.level >= maxLevel || hud.nutrients < cost} onClick={() => engineRef.current?.upgrade(hud.selected)}>
            {selectedState.level >= maxLevel ? "최대 레벨" : <><span>장기 강화 <i>Lv.{selectedState.level + 1}</i></span><b>● {cost}</b></>}
          </button>
          <p className="tip">단축키 · Q/W/E 스킬 · Space 즉시 시작 · 1/2/3 배속 · P 정지</p>
          <div className="wave-list">
            {WAVES.map((wave) => <div key={wave.wave} className={wave.wave === hud.wave ? "current" : wave.wave < hud.wave ? "done" : ""}>
              <span>{wave.wave < hud.wave ? "✓" : wave.clock.slice(0, 2)}</span>
              <p><b>{wave.label}</b><small>{wave.wave === WAVES.length ? "FINAL" : `${wave.groups.reduce((n, g) => n + g.count, 0)}기`}</small></p>
            </div>)}
          </div>
          </>}
        </aside>
      </div>

      {hud.phase === "cards" && <div className="modal-backdrop"><section className="card-modal" role="dialog" aria-modal="true" aria-label="생활 습관 카드 선택">
        <small className="eyebrow">{hud.clock} · WAVE {hud.wave} CLEAR</small><h2>내일의 몸을 결정하세요</h2><p>선택한 습관은 다음 웨이브부터 적용됩니다.</p>
        <div className="habit-cards">{hud.cards.map((card) => <article key={card.id}>
          <span className={`card-art card-${card.id}`} aria-hidden="true" /><small>{card.effectType === "permanent" ? "영구 효과" : card.effectType === "instant" ? "즉시 효과" : "다음 웨이브"}</small><h3>{card.name}</h3><p>{card.description}</p>{card.drawback && <em>주의 · {card.drawback}</em>}
          <button onClick={() => engineRef.current?.chooseCard(card.id)}>이 습관 선택</button>
        </article>)}</div>
      </section></div>}

      {(hud.phase === "victory" || hud.phase === "defeat") && <div className="modal-backdrop"><section className={`result ${hud.phase}`} role="dialog" aria-modal="true">
        <span className="result-icon">{hud.phase === "victory" ? "✦" : "×"}</span><small>{hud.phase === "victory" ? "DAY SURVIVED" : "VITAL SIGN LOST"}</small>
        <h2>{hud.phase === "victory" ? "오늘도 살아남았습니다." : "몸이 버티지 못했습니다."}</h2>
        <div><p><span>처치 수</span><b>{hud.kills}</b></p><p><span>최고 콤보</span><b>{hud.bestCombo}×</b></p><p><span>도달 시간대</span><b>{hud.clock}</b></p></div>
        <p className="levels">장기 레벨 · 폐 {hud.organs.lung.level} / 간 {hud.organs.liver.level} / 심장 {hud.organs.heart.level}</p>
        {best && <p className="best-record">개인 최고 · 처치 {best.kills} · 콤보 {best.combo}× · 도달 웨이브 {best.wave}/{WAVES.length}</p>}
        <button onClick={restart}>다시 방어하기</button>
      </section></div>}
    </main>
  );
}
