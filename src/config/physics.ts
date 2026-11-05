import type { PhysicsParams } from '../physics/types.ts';

/**
 * 物理の数値。docs/game-spec.md の「球と盤面」が基準。
 * - 球: 直径11mm、5g / 発射: 0.6秒に1発 / 計算: 1/240秒 / 上限50個
 * - 重力と反発は「案」なので、打ち心地を見て調整する。
 */
export const PHYSICS: PhysicsParams = {
  stepSeconds: 1 / 240,
  maxMovePerSubstep: 1.0,
  gravity: 5000,
  linearDrag: 0.2,
  ballRadius: 5.5,
  ballMassGrams: 5,
  maxBalls: 50,
  restitution: { nail: 0.6, wall: 0.4, rail: 0.2, bumper: 0.7, ball: 0.5 },
  friction: { nail: 0.1, wall: 0.1, rail: 0.01, bumper: 0.1, ball: 0.05 },
  restingSpeed: 30,
  stuckSeconds: 20,
  launcher: {
    intervalSeconds: 0.6,
    minSpeed: 1800,
    maxSpeed: 2800,
    speedJitter: 0.01,
  },
};
