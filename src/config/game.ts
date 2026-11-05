/**
 * ゲーム進行の数値。docs/game-spec.md の「スペック」「ノルマ」が基準。
 */
export const GAME = {
  /** 開始時の持ち玉 */
  initialBalls: 1000,
  /** 賞球(入賞1回で戻る玉の数) */
  prize: {
    heso: 1,
    denchu: 4,
    attacker: 15,
  },
} as const;
