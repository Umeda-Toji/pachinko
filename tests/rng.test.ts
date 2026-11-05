import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.ts';

describe('乱数', () => {
  it('同じ種からは同じ並びが出る', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('違う種からは違う並びが出る', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
    expect(same).toBeLessThan(5);
  });

  it('0以上1未満で、偏りが小さい', () => {
    const rng = new Rng(7);
    const n = 100000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('状態を取り出して戻すと、続きが再現できる', () => {
    const rng = new Rng(9);
    rng.next();
    const saved = rng.getState();
    const first = [rng.next(), rng.next()];
    rng.setState(saved);
    expect([rng.next(), rng.next()]).toEqual(first);
  });
});
