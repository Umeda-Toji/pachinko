import type { Rng } from '../core/rng.ts';
import type { PhysicsParams } from './types.ts';
import type { PhysicsWorld } from './world.ts';

/** ハンドルの強さ(0〜1)から発射の速さ(mm/s)を求める。強さに対して連続して変わる。 */
export function launchSpeed(handle: number, params: PhysicsParams): number {
  const h = handle < 0 ? 0 : handle > 1 ? 1 : handle;
  const l = params.launcher;
  return l.minSpeed + h * (l.maxSpeed - l.minSpeed);
}

/**
 * 発射装置。0.6秒に1発、ハンドルの強さに応じた速さで打つ。
 * firing が false の間は打たない(ストッパーや手を離した状態)。
 */
export class Launcher {
  /** ハンドルの強さ 0〜1 */
  handle = 0;
  firing = false;
  private timer: number;
  private readonly params: PhysicsParams;
  private readonly rng: Rng;

  constructor(params: PhysicsParams, rng: Rng) {
    this.params = params;
    this.rng = rng;
    // 打ち始めた瞬間に1発目が出るよう、待ち時間を満たしておく
    this.timer = params.launcher.intervalSeconds;
  }

  /** 物理の1ステップごとに呼ぶ。 */
  update(dt: number, world: PhysicsWorld): void {
    const interval = this.params.launcher.intervalSeconds;
    if (!this.firing) {
      this.timer = Math.min(this.timer + dt, interval);
      return;
    }
    // 小さな誤差で1ステップ遅れないよう、わずかに余裕を持たせて比べる
    if (this.timer + 1e-9 >= interval) {
      const jitter = this.params.launcher.speedJitter;
      const speed = launchSpeed(this.handle, this.params) * (1 + (this.rng.next() * 2 - 1) * jitter);
      // 盤面が満杯などで打てなければ、待ち時間を保ったまま次のステップで再挑戦する
      if (world.launch(speed)) this.timer -= interval;
    }
    this.timer += dt;
  }
}
