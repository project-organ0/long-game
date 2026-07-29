import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-copy">
        <span className="eyebrow">BODY DEFENSE PROTOCOL</span>
        <h1>오늘 하루도,<br /><em>장기전</em>입니다.</h1>
        <p>스트레스, 미세먼지, 알코올의 침투를 막고 세 장기를 성장시키세요.</p>
        <Link className="primary-link" href="/defense">방어 근무 시작 →</Link>
      </div>
      <div className="landing-visual" aria-label="장기전 캐릭터">
        <span>🫁</span><span>🫀</span><span>🟤</span>
      </div>
    </main>
  );
}
