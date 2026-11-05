import { MAT_BUMPER, MAT_FLAP, MAT_NAIL, MAT_RAIL, MAT_WALL, type BuiltBoard } from './board.ts';
import type { PhysicsParams } from './types.ts';

/** 物理で起きた出来事。音や画面はこれを受け取って反応する。 */
export const PhysicsEvent = {
  /** 発射した(ファールも含む) */
  Launch: 0,
  /** 発射した球が盤面に出た。これを「発射数」として数える */
  EnterBoard: 1,
  /** 力が足りず手元に戻った */
  Foul: 2,
  Heso: 3,
  Out: 4,
  /** 長く動かず取り除いた */
  Stuck: 5,
  /** 盤面の外へ出てしまった(本来は起きない) */
  Lost: 6,
  NailHit: 7,
  WallHit: 8,
  BallHit: 9,
} as const;
export type PhysicsEventType = (typeof PhysicsEvent)[keyof typeof PhysicsEvent];

/** type: 出来事、ball: 球の番号、value: 当たりの強さ(mm/s)など */
export type PhysicsListener = (type: PhysicsEventType, ball: number, value: number) => void;

export interface PhysicsStats {
  launched: number;
  enteredBoard: number;
  foul: number;
  heso: number;
  out: number;
  stuck: number;
  lost: number;
}

const PHASE_CHANNEL = 0;
const PHASE_BOARD = 1;
const TWO_PI = Math.PI * 2;
/** これより弱い当たりは音の出来事として知らせない(mm/s) */
const HIT_EVENT_SPEED = 50;

/**
 * 球と釘と壁の2D物理。1回の step() で必ず 1/240 秒進む。
 * 球の情報は最初に確保した配列を使い回し、計算中に新しいオブジェクトを作らない。
 */
export class PhysicsWorld {
  readonly board: BuiltBoard;
  readonly params: PhysicsParams;
  readonly maxBalls: number;

  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly age: Float64Array;
  readonly active: Uint8Array;
  readonly phase: Uint8Array;
  private readonly activeIdx: Int32Array;
  private activeCount = 0;

  /** 経過時間(秒) */
  time = 0;
  readonly stats: PhysicsStats = {
    launched: 0,
    enteredBoard: 0,
    foul: 0,
    heso: 0,
    out: 0,
    stuck: 0,
    lost: 0,
  };
  listener: PhysicsListener | null = null;

  private readonly rest: Float64Array;
  private readonly fric: Float64Array;

  constructor(board: BuiltBoard, params: PhysicsParams) {
    this.board = board;
    this.params = params;
    this.maxBalls = params.maxBalls;
    const n = params.maxBalls;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.age = new Float64Array(n);
    this.active = new Uint8Array(n);
    this.phase = new Uint8Array(n);
    this.activeIdx = new Int32Array(n);

    this.rest = new Float64Array(5);
    this.fric = new Float64Array(5);
    this.applyParams();
  }

  /**
   * params の反発と摩擦を計算用の表に写す。
   * 調整パネルなどで params を書き換えたら呼ぶ(重力などはそのまま反映される)。
   */
  applyParams(): void {
    const params = this.params;
    this.rest[MAT_NAIL] = params.restitution.nail;
    this.rest[MAT_WALL] = params.restitution.wall;
    this.rest[MAT_RAIL] = params.restitution.rail;
    this.rest[MAT_BUMPER] = params.restitution.bumper;
    this.fric[MAT_NAIL] = params.friction.nail;
    this.fric[MAT_WALL] = params.friction.wall;
    this.fric[MAT_RAIL] = params.friction.rail;
    this.fric[MAT_BUMPER] = params.friction.bumper;
    this.rest[MAT_FLAP] = params.restitution.wall;
    this.fric[MAT_FLAP] = params.friction.wall;
  }

  /** 盤面にある球の数 */
  get ballCount(): number {
    let c = 0;
    for (let i = 0; i < this.maxBalls; i++) c += this.active[i];
    return c;
  }

  /**
   * 発射位置に球を置く。上限に達しているか、発射位置がふさがっていれば false。
   * speed は発射の速さ(mm/s)。
   */
  launch(speed: number): boolean {
    const rail = this.board.rail;
    const d2min = (this.params.ballRadius * 2) ** 2;
    let slot = -1;
    for (let i = 0; i < this.maxBalls; i++) {
      if (!this.active[i]) {
        if (slot < 0) slot = i;
        continue;
      }
      const dx = this.x[i] - rail.launchX;
      const dy = this.y[i] - rail.launchY;
      if (dx * dx + dy * dy < d2min) return false;
    }
    if (slot < 0) return false;
    this.x[slot] = rail.launchX;
    this.y[slot] = rail.launchY;
    this.vx[slot] = rail.dirX * speed;
    this.vy[slot] = rail.dirY * speed;
    this.age[slot] = 0;
    this.phase[slot] = PHASE_CHANNEL;
    this.active[slot] = 1;
    this.stats.launched++;
    this.emit(PhysicsEvent.Launch, slot, speed);
    return true;
  }

  /**
   * 盤面の好きな位置に球を置く(テストや調整用)。発射数には数えない。
   * 置けたら球の番号、空きがなければ -1 を返す。
   */
  spawnAt(x: number, y: number, vx: number, vy: number): number {
    for (let i = 0; i < this.maxBalls; i++) {
      if (this.active[i]) continue;
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.age[i] = 0;
      this.phase[i] = PHASE_BOARD;
      this.active[i] = 1;
      return i;
    }
    return -1;
  }

  /** 1/240秒だけ進める。 */
  step(): void {
    const p = this.params;
    const dt = p.stepSeconds;

    // 動いている球を集め、一番速い球に合わせて細かく分ける回数を決める
    let n = 0;
    let maxV2 = 0;
    for (let i = 0; i < this.maxBalls; i++) {
      if (!this.active[i]) continue;
      this.activeIdx[n++] = i;
      const v2 = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
      if (v2 > maxV2) maxV2 = v2;
    }
    this.activeCount = n;
    if (n > 0) {
      const sub = Math.max(1, Math.ceil((Math.sqrt(maxV2) * dt) / p.maxMovePerSubstep));
      const h = dt / sub;
      const drag = 1 - p.linearDrag * h;
      for (let s = 0; s < sub; s++) {
        for (let k = 0; k < this.activeCount; k++) {
          const i = this.activeIdx[k];
          if (!this.active[i]) continue;
          // 重力で速さを変えてから位置を進める(安定しやすい順番)
          this.vy[i] -= p.gravity * h;
          this.vx[i] *= drag;
          this.vy[i] *= drag;
          this.x[i] += this.vx[i] * h;
          this.y[i] += this.vy[i] * h;
        }
        this.collideBalls();
        for (let k = 0; k < this.activeCount; k++) {
          const i = this.activeIdx[k];
          if (!this.active[i]) continue;
          // 2つの釘に同時に触れたときにも押し戻しきれるよう、2回くり返す
          this.collideStatic(i);
          this.collideStatic(i);
          this.checkSensors(i);
        }
      }
    }

    for (let k = 0; k < this.activeCount; k++) {
      const i = this.activeIdx[k];
      if (!this.active[i]) continue;
      this.age[i] += dt;
      if (this.age[i] > p.stuckSeconds) this.remove(i, PhysicsEvent.Stuck);
    }
    this.time += dt;
  }

  private remove(i: number, type: PhysicsEventType): void {
    this.active[i] = 0;
    const s = this.stats;
    if (type === PhysicsEvent.Heso) s.heso++;
    else if (type === PhysicsEvent.Out) s.out++;
    else if (type === PhysicsEvent.Foul) s.foul++;
    else if (type === PhysicsEvent.Stuck) s.stuck++;
    else if (type === PhysicsEvent.Lost) s.lost++;
    this.emit(type, i, 0);
  }

  private emit(type: PhysicsEventType, ball: number, value: number): void {
    if (this.listener) this.listener(type, ball, value);
  }

  /** 入賞、アウト、ファール、盤面に出たかを調べる。 */
  private checkSensors(i: number): void {
    const b = this.board;
    const x = this.x[i];
    const y = this.y[i];

    const rail = b.rail;
    const dx = x - rail.cx;
    const dy = y - rail.cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    // 発射位置から時計回りに進んだ角度
    let prog = rail.launchRad - Math.atan2(dy, dx);
    prog -= Math.floor(prog / TWO_PI) * TWO_PI;
    if (prog > rail.foulProgress && r > rail.innerRadius && r < rail.outerRadius + 1) {
      // 発射の通り道の底まで戻った = 手元に戻る球。発射数には数えない
      if (this.phase[i] === PHASE_BOARD) this.stats.enteredBoard--;
      this.remove(i, PhysicsEvent.Foul);
      return;
    }

    if (this.phase[i] === PHASE_CHANNEL) {
      const passed = prog > rail.innerEndProgress + 0.26 && prog < rail.foulProgress;
      if (passed || r < rail.innerRadius - this.params.ballRadius) {
        this.phase[i] = PHASE_BOARD;
        this.stats.enteredBoard++;
        this.emit(PhysicsEvent.EnterBoard, i, 0);
      }
      return;
    }

    const h = b.heso;
    if (y < h.sensorY && y > h.bottom - 1 && x > h.left && x < h.right) {
      this.remove(i, PhysicsEvent.Heso);
      return;
    }
    if (y < b.outY) {
      this.remove(i, PhysicsEvent.Out);
      return;
    }
    if (x < -20 || x > b.width + 20 || y > b.height + 20) {
      this.remove(i, PhysicsEvent.Lost);
    }
  }

  /** 釘と壁との当たり。近くのマスに登録されたものだけを調べる。 */
  private collideStatic(i: number): void {
    const b = this.board;
    const col = Math.floor(this.x[i] / b.gridCell);
    const row = Math.floor(this.y[i] / b.gridCell);
    if (col < 0 || col >= b.gridCols || row < 0 || row >= b.gridRows) return;
    const c = row * b.gridCols + col;
    const end = b.cellStart[c + 1];
    const rb = this.params.ballRadius;
    for (let k = b.cellStart[c]; k < end; k++) {
      const item = b.cellItems[k];
      if (item >= 0) {
        const nx0 = b.nails[item * 2];
        const ny0 = b.nails[item * 2 + 1];
        const R = rb + b.nailRadius;
        const dx = this.x[i] - nx0;
        const dy = this.y[i] - ny0;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-9) this.resolve(i, 0, 1, R, MAT_NAIL);
        else this.resolve(i, dx / d, dy / d, R - d, MAT_NAIL);
      } else {
        const s = -item - 1;
        // 弁は発射中の球を通し、盤面に出た後の球だけを止める
        if (b.segMat[s] === MAT_FLAP && this.phase[i] === PHASE_CHANNEL) continue;
        const ax = b.segs[s * 4];
        const ay = b.segs[s * 4 + 1];
        const ex = b.segs[s * 4 + 2] - ax;
        const ey = b.segs[s * 4 + 3] - ay;
        const len2 = ex * ex + ey * ey;
        let t = len2 > 0 ? ((this.x[i] - ax) * ex + (this.y[i] - ay) * ey) / len2 : 0;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const dx = this.x[i] - (ax + ex * t);
        const dy = this.y[i] - (ay + ey * t);
        const d2 = dx * dx + dy * dy;
        if (d2 >= rb * rb) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-9) {
          const len = Math.sqrt(len2);
          this.resolve(i, -ey / len, ex / len, rb, b.segMat[s]);
        } else {
          this.resolve(i, dx / d, dy / d, rb - d, b.segMat[s]);
        }
      }
    }
  }

  /** 重なりを押し戻し、跳ね返りと摩擦を与える。(nx, ny) は球へ向かう向き。 */
  private resolve(i: number, nx: number, ny: number, pen: number, mat: number): void {
    this.x[i] += nx * pen;
    this.y[i] += ny * pen;
    const vn = this.vx[i] * nx + this.vy[i] * ny;
    if (vn >= 0) return;
    const e = -vn < this.params.restingSpeed ? 0 : this.rest[mat];
    const jn = -(1 + e) * vn;
    this.vx[i] += jn * nx;
    this.vy[i] += jn * ny;
    // 摩擦: 押し返した強さに比例して横向きの速さを削る
    const tx = -ny;
    const ty = nx;
    const vt = this.vx[i] * tx + this.vy[i] * ty;
    const maxCut = this.fric[mat] * jn;
    const cut = vt > 0 ? Math.min(vt, maxCut) : Math.max(vt, -maxCut);
    this.vx[i] -= cut * tx;
    this.vy[i] -= cut * ty;
    if (-vn > HIT_EVENT_SPEED) {
      this.emit(mat === MAT_NAIL ? PhysicsEvent.NailHit : PhysicsEvent.WallHit, i, -vn);
    }
  }

  /** 球同士の当たり。同じ重さの球として扱う。 */
  private collideBalls(): void {
    const p = this.params;
    const D = p.ballRadius * 2;
    const D2 = D * D;
    const e = p.restitution.ball;
    const mu = p.friction.ball;
    for (let a = 0; a < this.activeCount; a++) {
      const i = this.activeIdx[a];
      if (!this.active[i]) continue;
      for (let b = a + 1; b < this.activeCount; b++) {
        const j = this.activeIdx[b];
        if (!this.active[j]) continue;
        const dx = this.x[i] - this.x[j];
        if (dx > D || dx < -D) continue;
        const dy = this.y[i] - this.y[j];
        const d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        const d = Math.sqrt(d2);
        let nx = 1;
        let ny = 0;
        if (d > 1e-9) {
          nx = dx / d;
          ny = dy / d;
        }
        const half = (D - d) / 2;
        this.x[i] += nx * half;
        this.y[i] += ny * half;
        this.x[j] -= nx * half;
        this.y[j] -= ny * half;
        const rvx = this.vx[i] - this.vx[j];
        const rvy = this.vy[i] - this.vy[j];
        const vn = rvx * nx + rvy * ny;
        if (vn >= 0) continue;
        const ee = -vn < p.restingSpeed ? 0 : e;
        const jn = (-(1 + ee) * vn) / 2;
        this.vx[i] += jn * nx;
        this.vy[i] += jn * ny;
        this.vx[j] -= jn * nx;
        this.vy[j] -= jn * ny;
        const tx = -ny;
        const ty = nx;
        const vt = rvx * tx + rvy * ty;
        const maxCut = mu * jn;
        const cut = (vt > 0 ? Math.min(vt, maxCut) : Math.max(vt, -maxCut)) / 2;
        this.vx[i] -= cut * tx;
        this.vy[i] -= cut * ty;
        this.vx[j] += cut * tx;
        this.vy[j] += cut * ty;
        if (-vn > HIT_EVENT_SPEED) this.emit(PhysicsEvent.BallHit, i, -vn);
      }
    }
  }
}
