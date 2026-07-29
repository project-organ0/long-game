"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DefenseEngine } from "./game-engine";
import { GAME_BALANCE, ORGANS, WAVES } from "./balance";
import type { HudState, OrganType, TargetMode } from "./types";

const TYPES: OrganType[] = ["lung", "liver", "heart"];
const TARGET_LABEL: Record<TargetMode, string> = { first: "선두 우선", last: "후미 우선", strong: "최강 우선" };

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
  cards: [], message: "방어 준비", clock: WAVES[0].clock, flavor: WAVES[0].flavor,
};

export default function DefenseGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DefenseEngine | null>(null);
  const [hud, setHud] = useState(initialHud);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new DefenseEngine(canvasRef.current, setHud);
    engineRef.current = engine;
    return () => { engine.destroy(); engineRef.current = null; };
  }, [run]);

  const selected = ORGANS[hud.selected];
  const selectedState = hud.organs[hud.selected];
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
        <div><small>생명력</small><strong className="life">♥ {hud.life}<i>/{hud.maxLife}</i></strong></div>
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
          <canvas ref={canvasRef} width="1000" height="600" aria-label="장기전 게임 맵" />

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
          <div className="panel-heading"><span className={`organ-avatar avatar-${hud.selected}`} style={{ backgroundColor: selected.color }} /><div><small>선택 장기 수호자</small><h2>{selected.name} <i>LV {selectedState.level}</i></h2></div></div>
          <p className="role">{selected.role}</p>
          <div className={`strain-meter ${hud.physiology.strain[hud.selected] > 70 ? "danger" : ""}`}>
            <span><small>장기 부담도</small><b>{Math.round(hud.physiology.strain[hud.selected])}%</b></span>
            <i><u style={{ width: `${hud.physiology.strain[hud.selected]}%`, background: selected.color }} /></i>
            <p>{hud.physiology.strain[hud.selected] > 70 ? "과부하 · 공격 효율이 감소합니다" : "안정 · 정상적으로 방어 중"}</p>
          </div>
          <div className="stats">
            <div><span>공격력</span><b>{stats.damage}</b></div>
            <div><span>공격속도</span><b>{stats.speed}<small>/초</small></b></div>
            <div><span>사거리</span><b>{stats.range}</b></div>
          </div>
          <div className="special"><small>SPECIAL</small><p>{selected.bonusAgainst === "dust" ? "미세먼지에 70% 추가 피해 · 주변 광역 피해" : selected.bonusAgainst === "alcohol" ? "알코올에 90% 추가 피해" : "카페인에 80% 추가 피해 · 초고속 연사"}</p></div>
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
        <button onClick={restart}>다시 방어하기</button>
      </section></div>}
    </main>
  );
}
