import { describe, expect, it } from 'vitest';
import { measureHeso, type HesoMeasurement } from '../src/physics/simulation.ts';

/**
 * 受け入れ基準: ハンドル最適時に、発射14.9玉に1回 ±10% でヘソへ入る。
 * 発射数はファールを除いた、盤面に出た球で数える。
 *
 * 1. ハンドル 0.00〜1.00 を 0.01 刻みで 1,000発ずつ打ち、よく入る強さを探す
 * 2. 上位3つの強さを、別の種で 20,000発ずつ打ち直して測る
 * 3. その中で一番よく入る強さを「最適」とし、目標の範囲に入るかを確かめる
 */
const TARGET = 14.9;
const LOW = TARGET * 0.9;
const HIGH = TARGET * 1.1;
const SWEEP_SHOTS = 1000;
const CONFIRM_SHOTS = 20000;

const fmt = (m: HesoMeasurement): string =>
  `| ${m.handle.toFixed(2)} | ${m.enteredBoard} | ${m.foul} | ${m.heso} | ${(m.hesoRate * 100).toFixed(2)}% | ${
    Number.isFinite(m.shotsPerHeso) ? m.shotsPerHeso.toFixed(1) : '-'
  } | ${m.stuck} |`;
const HEADER = '| ハンドル | 盤面に出た球 | ファール | ヘソ | 入賞率 | 何発に1回 | 止まった球 |\n|---|---|---|---|---|---|---|';

describe('ヘソ入賞率', () => {
  it(
    'ハンドル最適時に、発射14.9玉に1回 ±10% でヘソへ入る',
    () => {
      const sweep: HesoMeasurement[] = [];
      for (let i = 0; i <= 100; i++) sweep.push(measureHeso(i / 100, SWEEP_SHOTS, 1000 + i));

      // 0.05刻みの表(報告用)
      console.log(`\nハンドルの強さごとの入賞率(各${SWEEP_SHOTS}発)\n${HEADER}`);
      for (let i = 0; i <= 100; i += 5) console.log(fmt(sweep[i]));

      const top = [...sweep].sort((a, b) => b.hesoRate - a.hesoRate).slice(0, 3);
      const confirmed = top.map((m) => measureHeso(m.handle, CONFIRM_SHOTS, 50000 + Math.round(m.handle * 100)));
      console.log(`\nよく入る強さの打ち直し(各${CONFIRM_SHOTS}発)\n${HEADER}`);
      for (const m of confirmed) console.log(fmt(m));

      const best = confirmed.reduce((a, b) => (b.hesoRate > a.hesoRate ? b : a));
      console.log(`\n最適: ハンドル ${best.handle.toFixed(2)}、${best.shotsPerHeso.toFixed(2)}発に1回(目標 ${LOW.toFixed(2)}〜${HIGH.toFixed(2)})`);

      expect(best.shotsPerHeso).toBeGreaterThanOrEqual(LOW);
      expect(best.shotsPerHeso).toBeLessThanOrEqual(HIGH);

      // 盤面の外へ消える球や、止まったまま動かない球がないこと
      for (const m of [...sweep, ...confirmed]) {
        expect(m.lost).toBe(0);
        expect(m.stuck).toBe(0);
        expect(m.heso + m.out + m.foul).toBe(m.launched);
      }
    },
    600_000,
  );
});
