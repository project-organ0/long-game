import assert from "node:assert/strict";
import test from "node:test";

// 게임 밸런스 데이터의 불변식을 검증한다.
// 캔버스/DOM에 의존하지 않는 순수 데이터 계층만 대상으로 한다.
const {
  GAME_BALANCE,
  ORGANS,
  ENEMIES,
  CELL_TOWERS,
  WAVES,
  HABIT_CARDS,
} = await import("../app/defense/balance.ts");

const ORGAN_TYPES = ["lung", "liver", "heart"];
const ENEMY_TYPES = Object.keys(ENEMIES);

test("WAVES: 시간대 순서와 그룹 구성이 유효하다", () => {
  assert.ok(WAVES.length >= 1);
  WAVES.forEach((wave, i) => {
    assert.equal(wave.wave, i + 1, `웨이브 번호는 1부터 순차적이어야 한다 (index ${i})`);
    assert.ok(wave.clock && wave.label, `웨이브 ${wave.wave}에 시간대/라벨이 있어야 한다`);
    assert.ok(wave.groups.length > 0, `웨이브 ${wave.wave}에 최소 한 그룹이 있어야 한다`);
    for (const g of wave.groups) {
      assert.ok(ENEMIES[g.type], `알 수 없는 적 타입: ${g.type}`);
      assert.ok(g.count > 0, `그룹 count는 양수여야 한다 (${wave.wave}/${g.type})`);
      assert.ok(g.spawnInterval > 0, `spawnInterval은 양수여야 한다 (${wave.wave}/${g.type})`);
    }
  });
});

test("WAVES: 마지막 웨이브에만 보스가 등장한다", () => {
  WAVES.forEach((wave) => {
    const hasBoss = wave.groups.some((g) => ENEMIES[g.type].boss);
    if (wave.wave === WAVES.length) {
      assert.ok(hasBoss, "마지막 웨이브에는 보스가 있어야 한다");
    } else {
      assert.ok(!hasBoss, `웨이브 ${wave.wave}에는 보스가 없어야 한다`);
    }
  });
});

test("ENEMIES: 스탯이 모두 양수이고 보스는 하나뿐이다", () => {
  const bosses = ENEMY_TYPES.filter((t) => ENEMIES[t].boss);
  assert.equal(bosses.length, 1, "보스 타입은 정확히 하나여야 한다");
  for (const type of ENEMY_TYPES) {
    const e = ENEMIES[type];
    assert.equal(e.id, type, `id는 키와 일치해야 한다 (${type})`);
    assert.ok(e.maxHp > 0 && e.speed > 0 && e.reward > 0, `${type} 스탯은 양수여야 한다`);
    if (e.regen !== undefined) assert.ok(e.regen > 0);
  }
});

test("ORGANS: 3장기 구성과 보너스 대상이 유효하다", () => {
  assert.deepEqual(Object.keys(ORGANS).sort(), [...ORGAN_TYPES].sort());
  for (const type of ORGAN_TYPES) {
    const o = ORGANS[type];
    assert.equal(o.id, type);
    assert.ok(o.baseDamage > 0 && o.baseAttackSpeed > 0 && o.range > 0);
    assert.ok(ENEMIES[o.bonusAgainst], `보너스 대상이 유효한 적이어야 한다 (${type})`);
    assert.ok(o.bonusMultiplier > 1, `보너스 배율은 1보다 커야 한다 (${type})`);
    assert.ok(o.ability.cooldown > 0 && o.ability.duration > 0, `스킬 쿨다운/지속시간은 양수 (${type})`);
  }
});

test("CELL_TOWERS: stem + 3계열, 계열 타워는 키와 family가 일치한다", () => {
  assert.ok(CELL_TOWERS.stem, "미분화 세포(stem)가 존재해야 한다");
  for (const type of ORGAN_TYPES) {
    const t = CELL_TOWERS[type];
    assert.ok(t, `${type} 계열 타워가 존재해야 한다`);
    assert.equal(t.family, type, `계열 타워의 family는 키와 같아야 한다 (${type})`);
    assert.ok(t.cost > 0 && t.damage > 0 && t.attackSpeed > 0 && t.range > 0);
    assert.ok(ENEMIES[t.bonusAgainst], `타워 보너스 대상이 유효해야 한다 (${type})`);
  }
});

test("GAME_BALANCE: 레벨 배율 배열이 maxOrganLevel과 맞고 단조 증가한다", () => {
  const lv = GAME_BALANCE.maxOrganLevel;
  for (const key of ["levelDamageMultiplier", "levelSpeedMultiplier", "levelRangeMultiplier"]) {
    const arr = GAME_BALANCE[key];
    assert.equal(arr.length, lv, `${key} 길이는 maxOrganLevel(${lv})과 같아야 한다`);
    for (let i = 1; i < arr.length; i++) {
      assert.ok(arr[i] > arr[i - 1], `${key}는 단조 증가해야 한다 (index ${i})`);
    }
  }
  assert.equal(
    GAME_BALANCE.organUpgradeCosts.length,
    lv - 1,
    "업그레이드 비용 개수는 maxOrganLevel-1이어야 한다",
  );
  for (let i = 1; i < GAME_BALANCE.organUpgradeCosts.length; i++) {
    assert.ok(
      GAME_BALANCE.organUpgradeCosts[i] > GAME_BALANCE.organUpgradeCosts[i - 1],
      "업그레이드 비용은 레벨이 오를수록 비싸져야 한다",
    );
  }
});

test("GAME_BALANCE: 비용과 콤보 설정이 유효하다", () => {
  assert.ok(GAME_BALANCE.stemCost > 0);
  assert.ok(GAME_BALANCE.differentiationCost > GAME_BALANCE.stemCost, "분화는 심기보다 비싸야 한다");
  assert.ok(GAME_BALANCE.specializationCost > GAME_BALANCE.differentiationCost, "전문화는 분화보다 비싸야 한다");
  assert.ok(GAME_BALANCE.comboMax > 1 && GAME_BALANCE.comboStep > 0);
  assert.ok(GAME_BALANCE.speedOptions.length > 0);
});

test("HABIT_CARDS: id가 고유하고 effectType가 유효하다", () => {
  const ids = HABIT_CARDS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "습관 카드 id는 고유해야 한다");
  const validTypes = new Set(["permanent", "nextWave", "instant", "choice"]);
  for (const card of HABIT_CARDS) {
    assert.ok(card.name && card.description, `${card.id}에 이름/설명이 있어야 한다`);
    assert.ok(validTypes.has(card.effectType), `${card.id}의 effectType가 유효해야 한다`);
  }
});
