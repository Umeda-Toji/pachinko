/**
 * 描画の速さと関係なく、決まった間隔で計算を進めるための仕組み。
 * 経過時間をためておき、間隔の分だけ step を呼ぶ。
 */
export class FixedStepper {
  private acc = 0;
  readonly stepSeconds: number;
  /** 1回の advance で進める最大の回数。端末が一時的に止まったときに計算が追いつかなくなるのを防ぐ */
  readonly maxSteps: number;

  constructor(stepSeconds: number, maxSteps: number) {
    this.stepSeconds = stepSeconds;
    this.maxSteps = maxSteps;
  }

  /** elapsedSeconds だけ時間を進め、実行した step の回数を返す。 */
  advance(elapsedSeconds: number, step: () => void): number {
    this.acc += Math.max(0, elapsedSeconds);
    let n = 0;
    // 小さな誤差で1回少なくならないよう、わずかに余裕を持たせて比べる
    while (this.acc + 1e-9 >= this.stepSeconds && n < this.maxSteps) {
      step();
      this.acc -= this.stepSeconds;
      n++;
    }
    // 上限で打ち切った分は捨てる(遅れを取り戻そうとして固まらないように)
    if (n === this.maxSteps && this.acc >= this.stepSeconds) this.acc = 0;
    return n;
  }
}
