import { describe, expect, it } from 'vitest';
import { BOARD } from '../src/config/board.ts';
import { PHYSICS } from '../src/config/physics.ts';
import { Rng } from '../src/core/rng.ts';
import { buildBoard } from '../src/physics/board.ts';
import { launchSpeed } from '../src/physics/launcher.ts';
import { measureHeso, Simulation } from '../src/physics/simulation.ts';
import type { BoardConfig } from '../src/physics/types.ts';
import { PhysicsEvent, PhysicsWorld } from '../src/physics/world.ts';

const LONG = 120_000;

describe('計算の間隔', () => {
  it('1回の step で必ず 1/240 秒進む', () => {
    const sim = new Simulation(1);
    sim.launcher.handle = 0.5;
    sim.launcher.firing = true;
    for (let i = 0; i < 240; i++) sim.step();
    expect(PHYSICS.stepSeconds).toBe(1 / 240);
    expect(sim.world.time).toBeCloseTo(1, 9);
  });
});

describe('発射', () => {
  it('ハンドルの強さに対して、速さがなめらかに増える', () => {
    let prev = launchSpeed(0, PHYSICS);
    for (let i = 1; i <= 1000; i++) {
      const v = launchSpeed(i / 1000, PHYSICS);
      expect(v).toBeGreaterThan(prev);
      // 0.001 の違いで速さが大きく飛ばない
      expect(v - prev).toBeLessThan(5);
      prev = v;
    }
    expect(launchSpeed(-1, PHYSICS)).toBe(launchSpeed(0, PHYSICS));
    expect(launchSpeed(2, PHYSICS)).toBe(launchSpeed(1, PHYSICS));
  });

  it('0.6秒に1発ずつ打つ', () => {
    const sim = new Simulation(1);
    const times: number[] = [];
    sim.world.listener = (type) => {
      if (type === PhysicsEvent.Launch) times.push(sim.world.time);
    };
    sim.launcher.handle = 0.32;
    sim.launcher.firing = true;
    for (let i = 0; i < 240 * 6; i++) sim.step();
    expect(times.length).toBe(10);
    for (let k = 1; k < times.length; k++) expect(times[k] - times[k - 1]).toBeCloseTo(0.6, 9);
  });

  it('打つのを止めている間は発射しない', () => {
    const sim = new Simulation(1);
    sim.launcher.handle = 0.5;
    sim.launcher.firing = false;
    for (let i = 0; i < 240 * 3; i++) sim.step();
    expect(sim.world.stats.launched).toBe(0);
  });

  it('ハンドルが弱すぎる球はファールになり、発射数に数えない', () => {
    const m = measureHeso(0, 50, 1);
    expect(m.foul).toBe(50);
    expect(m.enteredBoard).toBe(0);
  });

  it('盤面の球は50個までで、それ以上は置けない', () => {
    const world = new PhysicsWorld(buildBoard(BOARD, PHYSICS.ballRadius, PHYSICS.maxMovePerSubstep), PHYSICS);
    for (let i = 0; i < 50; i++) expect(world.spawnAt(60 + (i % 10) * 12, 250 + Math.floor(i / 10) * 12, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(world.spawnAt(200, 300, 0, 0)).toBe(-1);
    expect(world.launch(2000)).toBe(false);
    expect(world.ballCount).toBe(50);
  });
});

describe('貫通しない', () => {
  // 球の直径(11mm)より狭いすき間(10mm)で釘を一列に並べた柵
  const fenceBoard: BoardConfig = {
    ...BOARD,
    walls: [],
    nailGroups: [{ kind: 'line', name: '柵', from: [30, 250], to: [426, 250], spacing: 12 }],
  };

  it('とても速い球を釘の柵に当てても、すり抜けない', () => {
    const world = new PhysicsWorld(
      buildBoard(fenceBoard, PHYSICS.ballRadius, PHYSICS.maxMovePerSubstep),
      PHYSICS,
    );
    const rng = new Rng(5);
    let passed = 0;
    for (let round = 0; round < 20; round++) {
      for (let k = 0; k < 40; k++) {
        // 発射の最大速度(2800mm/s)より速い 4000mm/s で、斜めからも当てる
        const angle = (rng.next() - 0.5) * 1.2;
        world.spawnAt(80 + rng.next() * 280, 300 + rng.next() * 60, Math.sin(angle) * 4000, -Math.cos(angle) * 4000);
      }
      for (let s = 0; s < 240 * 0.5; s++) {
        world.step();
      }
      for (let i = 0; i < world.maxBalls; i++) {
        if (world.active[i] && world.y[i] < 250) passed++;
        world.active[i] = 0;
      }
    }
    expect(passed).toBe(0);
  });

  it(
    '実際の盤面で打ち続けても、球が釘や壁にめり込まない',
    () => {
      const tol = 0.5;
      let worst = 0;
      for (const handle of [0.11, 0.32, 0.6, 1.0]) {
        const sim = new Simulation(3);
        const w = sim.world;
        const b = w.board;
        sim.launcher.handle = handle;
        sim.launcher.firing = true;
        while (w.stats.launched < 150) {
          sim.step();
          for (let i = 0; i < w.maxBalls; i++) {
            if (!w.active[i]) continue;
            for (let n = 0; n < b.nailCount; n++) {
              const d = Math.hypot(w.x[i] - b.nails[n * 2], w.y[i] - b.nails[n * 2 + 1]);
              worst = Math.max(worst, PHYSICS.ballRadius + b.nailRadius - d);
            }
            for (let s = 0; s < b.segCount; s++) {
              if (b.segMat[s] === 4 && w.phase[i] === 0) continue; // 弁は発射中の球を通す
              const ax = b.segs[s * 4];
              const ay = b.segs[s * 4 + 1];
              const ex = b.segs[s * 4 + 2] - ax;
              const ey = b.segs[s * 4 + 3] - ay;
              const t = Math.max(0, Math.min(1, ((w.x[i] - ax) * ex + (w.y[i] - ay) * ey) / (ex * ex + ey * ey)));
              const d = Math.hypot(w.x[i] - (ax + ex * t), w.y[i] - (ay + ey * t));
              worst = Math.max(worst, PHYSICS.ballRadius - d);
            }
          }
        }
        expect(w.stats.lost).toBe(0);
      }
      expect(worst).toBeLessThan(tol);
    },
    LONG,
  );
});

describe('再現性', () => {
  it('同じ種なら、何度計算しても同じ結果になる', () => {
    const a = measureHeso(0.32, 300, 77);
    const b = measureHeso(0.32, 300, 77);
    expect(b).toEqual(a);
  });

  it('種が違えば、球筋が変わる', () => {
    const a = measureHeso(0.32, 300, 1);
    const b = measureHeso(0.32, 300, 2);
    expect(b.heso === a.heso && b.out === a.out && b.simSeconds === a.simSeconds).toBe(false);
  });
});
