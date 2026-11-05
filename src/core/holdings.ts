/**
 * 持ち玉と、打った結果の集計。
 * - 1発打つと1玉減る。ファールの球は手元に戻る。
 * - ヘソに入ると賞球が戻る。
 */
export class Holdings {
  balls: number;
  /** 発射した数(ファールも含む) */
  launched = 0;
  /** 手元に戻ったファールの数 */
  fouls = 0;
  hesoCount = 0;
  /** 受け取った賞球の合計 */
  prizeTotal = 0;

  private readonly initial: number;
  private readonly hesoPrize: number;

  constructor(initialBalls: number, hesoPrize: number) {
    this.initial = initialBalls;
    this.hesoPrize = hesoPrize;
    this.balls = initialBalls;
  }

  canFire(): boolean {
    return this.balls > 0;
  }

  onLaunch(): void {
    this.balls--;
    this.launched++;
  }

  onFoul(): void {
    this.balls++;
    this.fouls++;
  }

  onHeso(): void {
    this.balls += this.hesoPrize;
    this.hesoCount++;
    this.prizeTotal += this.hesoPrize;
  }

  /** 盤面に出た球の数(発射数からファールを除いたもの) */
  get shots(): number {
    return this.launched - this.fouls;
  }

  /** 1回転(ヘソ入賞1回)あたりに減った玉の数。まだ入賞がなければ null */
  get costPerSpin(): number | null {
    if (this.hesoCount === 0) return null;
    return (this.shots - this.prizeTotal) / this.hesoCount;
  }

  reset(): void {
    this.balls = this.initial;
    this.launched = 0;
    this.fouls = 0;
    this.hesoCount = 0;
    this.prizeTotal = 0;
  }
}
