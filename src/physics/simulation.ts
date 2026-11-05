import { BOARD } from '../config/board.ts';
import { PHYSICS } from '../config/physics.ts';
import { Rng } from '../core/rng.ts';
import { buildBoard } from './board.ts';
import { Launcher } from './launcher.ts';
import type { BoardConfig, PhysicsParams } from './types.ts';
import { PhysicsWorld, type PhysicsStats } from './world.ts';

/** 盤面、発射装置、乱数をまとめたもの。画面ありでも画面なしでも同じものを使う。 */
export class Simulation {
  readonly world: PhysicsWorld;
  readonly launcher: Launcher;
  readonly rng: Rng;

  constructor(seed: number, board: BoardConfig = BOARD, params: PhysicsParams = PHYSICS) {
    this.rng = new Rng(seed);
    this.world = new PhysicsWorld(buildBoard(board, params.ballRadius, params.maxMovePerSubstep), params);
    this.launcher = new Launcher(params, this.rng);
  }

  /** 1/240秒進める。 */
  step(): void {
    this.launcher.update(this.world.params.stepSeconds, this.world);
    this.world.step();
  }
}

export interface HesoMeasurement extends PhysicsStats {
  handle: number;
  /** ヘソ入賞1回あたりの発射数(盤面に出た球で数える)。入賞0なら Infinity */
  shotsPerHeso: number;
  /** 盤面に出た球のうち、ヘソに入った割合 */
  hesoRate: number;
  simSeconds: number;
}

/**
 * ハンドルを固定して attempts 発打ち、ヘソ入賞率を測る。
 * 打ち終わったら、盤面の球がなくなるまで計算を続ける。
 */
export function measureHeso(
  handle: number,
  attempts: number,
  seed: number,
  board: BoardConfig = BOARD,
  params: PhysicsParams = PHYSICS,
): HesoMeasurement {
  const sim = new Simulation(seed, board, params);
  sim.launcher.handle = handle;
  sim.launcher.firing = true;
  const w = sim.world;
  while (w.stats.launched < attempts) sim.step();
  sim.launcher.firing = false;
  const limit = w.time + params.stuckSeconds + 5;
  while (w.ballCount > 0 && w.time < limit) sim.step();
  const s = w.stats;
  return {
    ...s,
    handle,
    shotsPerHeso: s.heso > 0 ? s.enteredBoard / s.heso : Infinity,
    hesoRate: s.enteredBoard > 0 ? s.heso / s.enteredBoard : 0,
    simSeconds: w.time,
  };
}
