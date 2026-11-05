import { describe, expect, it } from 'vitest';
import { rotateHandle, WheelAccumulator, wheelDeltaToPixels, wrapAngle } from '../src/ui/handleMath.ts';

describe('ハンドルの操作', () => {
  it('180度回すと 0 から 1 まで動き、範囲の外へは出ない', () => {
    expect(rotateHandle(0, Math.PI)).toBeCloseTo(1, 9);
    expect(rotateHandle(0, Math.PI / 2)).toBeCloseTo(0.5, 9);
    expect(rotateHandle(0.9, Math.PI)).toBe(1);
    expect(rotateHandle(0.1, -Math.PI)).toBe(0);
  });

  it('角度の差は -180〜180度に直す(真左をまたいでも飛ばない)', () => {
    expect(wrapAngle(Math.PI * 1.9)).toBeCloseTo(-Math.PI * 0.1, 9);
    expect(wrapAngle(-Math.PI * 1.9)).toBeCloseTo(Math.PI * 0.1, 9);
  });

  it('ホイール1目盛り(100ピクセル)で 0.01、Shift を押すと 0.001 動く', () => {
    const w = new WheelAccumulator();
    expect(w.apply(0.3, -100, false)).toBe(0.31);
    expect(w.apply(0.3, 100, false)).toBe(0.29);
    expect(w.apply(0.3, -100, true)).toBe(0.301);
    expect(w.apply(0, 100, false)).toBe(0);
    expect(w.apply(1, -100, false)).toBe(1);
  });

  it('回した量に比例して動く(10目盛りまとめても、細かく何度届いても同じ)', () => {
    const big = new WheelAccumulator();
    expect(big.apply(0, -1000, false)).toBe(0.1);
    const small = new WheelAccumulator();
    let v = 0;
    for (let i = 0; i < 250; i++) v = small.apply(v, -4, false);
    expect(v).toBe(0.1);
  });

  it('行やページ単位の回転量もピクセルに直す', () => {
    expect(wheelDeltaToPixels(100, 0)).toBe(100);
    expect(wheelDeltaToPixels(3, 1)).toBe(99);
    expect(wheelDeltaToPixels(1, 2)).toBe(800);
  });
});
