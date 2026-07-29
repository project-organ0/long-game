"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DefenseEngine } from "./game-engine";
import { GAME_BALANCE, ORGANS, WAVES } from "./balance";
import type { HudState, OrganType } from "./types";

const initialHud: HudState = {
  phase: "prep", wave: 1, life: 10, nutrients: 60, elapsed: 0, remaining: 0, countdown: 5, kills: 0, selected: "heart",
  organs: { lung: { id: "lung", level: 1 }, liver: { id: "liver", level: 1 }, heart: { id: "heart", level: 1 } }, cards: [], message: "방어 준비",
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
  const stats = useMemo(() => ({
    damage: Math.round(selected.baseDamage * GAME_BALANCE.levelDamageMultiplier[selectedState.level - 1]),
    speed: (selected.baseAttackSpeed * GAME_BALANCE.levelSpeedMultiplier[selectedState.level - 1]).toFixed(2),
    range: Math.round(selected.range * GAME_BALANCE.levelRangeMultiplier[selectedState.level - 1]),
  }), [selected, selectedState.level]);
  const cost = selectedState.level < 3 ? GAME_BALANCE.organUpgradeCosts[selectedState.level - 1] : 0;
  const time = `${String(Math.floor(hud.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(hud.elapsed % 60)).padStart(2, "0")}`;

  const restart = () => { setHud(initialHud); setPaused(false); setRun((n) => n + 1); };
  const pause = () => { engineRef.current?.togglePause(); setPaused((p) => !p); };
  const select = (id: OrganType) => engineRef.current?.selectOrgan(id);

  return (
    <main className="game-shell">
      <header className="game-header">
        <div><Link href="/" className="back-link">← 처음으로</Link><h1>장기<span>전</span></h1></div>
        <p>오늘 하루 생존 프로토콜</p>
        <button className="pause-button" onClick={pause} aria-label={paused ? "게임 재개" : "게임 일시정지"}>{paused ? "▶ 재개" : "Ⅱ 정지"}</button>
      </header>

      <section className="hud" aria-label="게임 상태">
        <div><small>현재 웨이브</small><strong>{hud.wave}<i>/5</i></strong></div>
        <div><small>생명력</small><strong className="life">♥ {hud.life}<i>/10</i></strong></div>
        <div><small>영양분</small><strong className="nutrient">● {hud.nutrients}</strong></div>
        <div><small>남은 침입자</small><strong>{hud.remaining}</strong></div>
        <div><small>생존 시간</small><strong>{time}</strong></div>
      </section>

      <div className="game-grid">
        <section className="arena-wrap">
          <div className={`wave-banner ${hud.phase}`}>
            <span>{hud.phase === "prep" ? `다음 웨이브까지 ${Math.ceil(hud.countdown)}` : hud.phase === "wave" ? `WAVE ${hud.wave}` : "생활 습관 정비"}</span>
            <b>{hud.message}</b>
          </div>
          <canvas ref={canvasRef} width="1000" height="600" aria-label="장기전 게임 맵" />
          <div className="organ-tabs">
            {(Object.keys(ORGANS) as OrganType[]).map((id) => (
              <button key={id} className={hud.selected === id ? "active" : ""} style={{ "--organ": ORGANS[id].color } as React.CSSProperties} onClick={() => select(id)}>
                <span>{ORGANS[id].emoji}</span><b>{ORGANS[id].name}</b><small>LV {hud.organs[id].level}</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="organ-panel">
          <div className="panel-heading"><span style={{ background: selected.color }}>{selected.emoji}</span><div><small>선택 장기</small><h2>{selected.name} <i>LV {selectedState.level}</i></h2></div></div>
          <p className="role">{selected.role}</p>
          <div className="stats">
            <div><span>공격력</span><b>{stats.damage}</b></div>
            <div><span>공격속도</span><b>{stats.speed}<small>/초</small></b></div>
            <div><span>사거리</span><b>{stats.range}</b></div>
          </div>
          <div className="special"><small>SPECIAL</small><p>{selected.bonusAgainst === "dust" ? "미세먼지에 60% 추가 피해 · 주변 광역 피해" : selected.bonusAgainst === "alcohol" ? "알코올에 80% 추가 피해" : "가장 빠른 연속 단일 공격"}</p></div>
          <button className="upgrade" disabled={selectedState.level >= 3 || hud.nutrients < cost} onClick={() => engineRef.current?.upgrade(hud.selected)}>
            {selectedState.level >= 3 ? "최대 레벨" : <><span>장기 강화</span><b>● {cost}</b></>}
          </button>
          <p className="tip">맵 또는 아래 버튼에서 장기를 선택하면 사거리를 볼 수 있습니다.</p>
          <div className="wave-list">
            {WAVES.map((wave) => <div key={wave.wave} className={wave.wave === hud.wave ? "current" : wave.wave < hud.wave ? "done" : ""}><span>{wave.wave < hud.wave ? "✓" : wave.wave}</span><p><b>{wave.label}</b><small>{wave.wave === 5 ? "FINAL BOSS" : `${wave.groups.reduce((n, g) => n + g.count, 0)}기 침투`}</small></p></div>)}
          </div>
        </aside>
      </div>

      {hud.phase === "cards" && <div className="modal-backdrop"><section className="card-modal" role="dialog" aria-modal="true" aria-label="생활 습관 카드 선택">
        <small className="eyebrow">WAVE {hud.wave} CLEAR</small><h2>내일의 몸을 결정하세요</h2><p>선택한 습관은 다음 웨이브부터 적용됩니다.</p>
        <div className="habit-cards">{hud.cards.map((card) => <article key={card.id}>
          <span className="card-icon">{card.icon}</span><small>{card.effectType === "permanent" ? "영구 효과" : card.effectType === "instant" ? "즉시 효과" : "다음 웨이브"}</small><h3>{card.name}</h3><p>{card.description}</p>{card.drawback && <em>주의 · {card.drawback}</em>}
          <button onClick={() => engineRef.current?.chooseCard(card.id)}>이 습관 선택</button>
        </article>)}</div>
      </section></div>}

      {(hud.phase === "victory" || hud.phase === "defeat") && <div className="modal-backdrop"><section className={`result ${hud.phase}`} role="dialog" aria-modal="true">
        <span className="result-icon">{hud.phase === "victory" ? "✦" : "×"}</span><small>{hud.phase === "victory" ? "DAY SURVIVED" : "VITAL SIGN LOST"}</small>
        <h2>{hud.phase === "victory" ? "오늘도 살아남았습니다." : "몸이 버티지 못했습니다."}</h2>
        <div><p><span>처치 수</span><b>{hud.kills}</b></p><p><span>도달 웨이브</span><b>{hud.wave} / 5</b></p><p><span>남은 생명력</span><b>{hud.life}</b></p></div>
        <p className="levels">장기 레벨 · 폐 {hud.organs.lung.level} / 간 {hud.organs.liver.level} / 심장 {hud.organs.heart.level}</p>
        <button onClick={restart}>다시 방어하기</button>
      </section></div>}
    </main>
  );
}
