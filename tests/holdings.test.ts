import { describe, expect, it } from 'vitest';
import { GAME } from '../src/config/game.ts';
import { FixedStepper } from '../src/core/fixedStep.ts';
import { Holdings } from '../src/core/holdings.ts';

describe('持ち玉', () => {
  it('1,000玉から始まり、打つと減り、ファールとヘソで戻る', () => {
    const h = new Holdings(GAME.initialBalls, GAME.prize.heso);
    expect(h.balls).toBe(1000);
    h.onLaunch();
    h.onLaunch();
    h.onLaunch();
    expect(h.balls).toBe(997);
    h.onFoul();
    expect(h.balls).toBe(998);
    expect(h.shots).toBe(2);
    h.onHeso();
    expect(h.balls).toBe(999);
  });

  it('1回転あたりの消費は (盤面に出た球 − 賞球) ÷ ヘソ入賞数', () => {
    const h = new Holdings(1000, 1);
    expect(h.costPerSpin).toBeNull();
    for (let i = 0; i < 149; i++) h.onLaunch();
    for (let i = 0; i < 10; i++) h.onHeso();
    // (149 − 10) ÷ 10 = 13.9
    expect(h.costPerSpin).toBeCloseTo(13.9, 9);
  });

  it('0玉になると打てない。やり直すと1,000玉に戻る', () => {
    const h = new Holdings(2, 1);
    h.onLaunch();
    h.onLaunch();
    expect(h.canFire()).toBe(false);
    h.reset();
    expect(h.balls).toBe(2);
    expect(h.launched).toBe(0);
  });
});

describe('固定間隔の計算', () => {
  it('描画の間隔が変わっても、1秒で240回だけ計算する', () => {
    for (const fps of [30, 60, 144, 37]) {
      const s = new FixedStepper(1 / 240, 1000);
      let steps = 0;
      for (let f = 0; f < fps; f++) s.advance(1 / fps, () => steps++);
      expect(steps).toBe(240);
    }
  });

  it('長く止まったときは、上限の回数で打ち切る', () => {
    const s = new FixedStepper(1 / 240, 60);
    let steps = 0;
    expect(s.advance(5, () => steps++)).toBe(60);
    // 打ち切った遅れは持ち越さない
    expect(s.advance(1 / 240, () => steps++)).toBe(1);
  });
});
