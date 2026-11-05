/** ハンドルの回転の計算。画面なしでテストできるよう、DOMから分けておく。 */

/** ハンドルが 0 から 1 まで回る角度(度) */
export const HANDLE_SWEEP_DEG = 180;

/** 角度(ラジアン)の差を -π〜π に直す。 */
export function wrapAngle(a: number): number {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 指やマウスの回転量(ラジアン、時計回りが正)だけハンドルを回した後の値。 */
export function rotateHandle(value: number, deltaRad: number): number {
  return clamp01(value + (deltaRad * 180) / Math.PI / HANDLE_SWEEP_DEG);
}

/** ホイールの回転量(ピクセル)がこれだけたまるごとに、ハンドルを1段階動かす。一般的なマウスの1目盛り */
export const WHEEL_PIXELS_PER_NOTCH = 100;

/**
 * ホイールの回転量をためて、ハンドルを動かす。
 * マウスは1目盛り(約100ピクセル)で 0.01、Shift を押しながらなら 0.001 動く。
 * トラックパッドのように細かい量が何度も届いても、回した量に比例して動く。
 * 奥へ回す(deltaY が負)と強くなる。
 */
export class WheelAccumulator {
  private acc = 0;

  /** 回転量を足し、動かした後のハンドルの値を返す。 */
  apply(value: number, deltaPixels: number, fine: boolean): number {
    this.acc += deltaPixels;
    const notches = Math.trunc(this.acc / WHEEL_PIXELS_PER_NOTCH);
    if (notches === 0) return value;
    this.acc -= notches * WHEEL_PIXELS_PER_NOTCH;
    const step = fine ? 0.001 : 0.01;
    return clamp01(Math.round((value - notches * step) * 1000) / 1000);
  }
}

/** WheelEvent の deltaMode(0: ピクセル、1: 行、2: ページ)をピクセルに直す。 */
export function wheelDeltaToPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 33;
  if (deltaMode === 2) return deltaY * 800;
  return deltaY;
}
