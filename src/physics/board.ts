import type { BoardConfig, Material, NailGroup, Vec2 } from './types.ts';

/** 材質を数値で持つ。物理の計算中に文字列を比べないため。 */
export const MAT_NAIL = 0;
export const MAT_WALL = 1;
export const MAT_RAIL = 2;
export const MAT_BUMPER = 3;
/** 戻り球防止弁。盤面に出た後の球だけを止める一方通行の壁 */
export const MAT_FLAP = 4;

const MATERIAL_INDEX: Record<Material, number> = {
  wall: MAT_WALL,
  rail: MAT_RAIL,
  bumper: MAT_BUMPER,
};

const DEG = Math.PI / 180;

/**
 * 計算しやすい形に組み立てた盤面。
 * 釘と壁は、近くにあるものだけを素早く探せるよう格子に登録しておく。
 */
export interface BuiltBoard {
  /** 釘の中心 [x0, y0, x1, y1, ...] */
  nails: Float64Array;
  nailCount: number;
  nailRadius: number;
  /** 壁の線分 [ax, ay, bx, by, ...] */
  segs: Float64Array;
  segMat: Uint8Array;
  segCount: number;

  gridCell: number;
  gridCols: number;
  gridRows: number;
  /** 格子の各マスに入っている物の範囲。cellItems[cellStart[c] .. cellStart[c+1]] */
  cellStart: Int32Array;
  /** 0以上は釘の番号、負の数は -(壁の番号 + 1) */
  cellItems: Int32Array;

  heso: { left: number; right: number; sensorY: number; bottom: number };
  outY: number;
  width: number;
  height: number;

  rail: {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
    launchRad: number;
    /** 発射位置から内レールの終わりまでの角度(ラジアン) */
    innerEndProgress: number;
    /** 進んだ角度がこれより大きければ、発射位置より後ろ(通り道の底)にいる */
    foulProgress: number;
    launchX: number;
    launchY: number;
    /** 発射の向き(長さ1) */
    dirX: number;
    dirY: number;
  };
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  mat: number;
}

/** 盤面の設定から、計算用の盤面を作る。ballRadius は格子の余白に使う。 */
export function buildBoard(config: BoardConfig, ballRadius: number, maxMove: number): BuiltBoard {
  const segs: Seg[] = [];
  const addPolyline = (points: readonly Vec2[], closed: boolean, mat: number): void => {
    const n = points.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], mat });
    }
  };

  // レール
  const r = config.rail;
  const [cx, cy] = r.center;
  const arc = (radius: number, fromDeg: number, toDeg: number): Vec2[] => {
    const pts: Vec2[] = [];
    const steps = Math.max(1, Math.ceil(Math.abs(fromDeg - toDeg) / r.segmentDeg));
    for (let i = 0; i <= steps; i++) {
      const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
      pts.push([cx + radius * Math.cos(deg * DEG), cy + radius * Math.sin(deg * DEG)]);
    }
    return pts;
  };
  addPolyline(arc(r.outerRadius, r.startDeg, r.outerEndDeg), false, MAT_RAIL);
  addPolyline(arc(r.outerRadius, r.outerEndDeg, r.outerWallEndDeg), false, MAT_WALL);
  addPolyline(arc(r.innerRadius, r.startDeg, r.innerEndDeg), false, MAT_RAIL);
  // 戻り球防止弁: 内レールの終わりで、通り道をふさぐ
  addPolyline(
    [
      [cx + r.innerRadius * Math.cos(r.innerEndDeg * DEG), cy + r.innerRadius * Math.sin(r.innerEndDeg * DEG)],
      [cx + r.outerRadius * Math.cos(r.innerEndDeg * DEG), cy + r.outerRadius * Math.sin(r.innerEndDeg * DEG)],
    ],
    false,
    MAT_FLAP,
  );
  // 発射の通り道の底
  addPolyline(
    [
      [cx + r.innerRadius * Math.cos(r.startDeg * DEG), cy + r.innerRadius * Math.sin(r.startDeg * DEG)],
      [cx + r.outerRadius * Math.cos(r.startDeg * DEG), cy + r.outerRadius * Math.sin(r.startDeg * DEG)],
    ],
    false,
    MAT_WALL,
  );
  // 返しゴム
  const bumperBase: Vec2 = [
    cx + r.outerRadius * Math.cos(r.outerEndDeg * DEG),
    cy + r.outerRadius * Math.sin(r.outerEndDeg * DEG),
  ];
  addPolyline([bumperBase, r.bumperTip], false, MAT_BUMPER);

  // 壁
  for (const w of config.walls) addPolyline(w.points, w.closed ?? false, MATERIAL_INDEX[w.material]);

  // ヘソ
  const h = config.heso;
  const hl = h.x - h.openingWidth / 2;
  const hr = h.x + h.openingWidth / 2;
  const sensorY = h.y - h.depth;
  // 底は判定の線より十分深くし、入った球が線の上で止まらないようにする
  const bottom = sensorY - ballRadius - 4;
  addPolyline(
    [
      [hl - h.shoulderWidth, h.y - h.shoulderDrop],
      [hl, h.y],
      [hl, bottom],
      [hr, bottom],
      [hr, h.y],
      [hr + h.shoulderWidth, h.y - h.shoulderDrop],
    ],
    false,
    MAT_WALL,
  );
  // ヘソの下の台。肩から外れた球が下へ流れるように閉じる
  addPolyline(
    [
      [hl - h.shoulderWidth, h.y - h.shoulderDrop],
      [hl - 4, bottom - 10],
      [hr + 4, bottom - 10],
      [hr + h.shoulderWidth, h.y - h.shoulderDrop],
    ],
    false,
    MAT_WALL,
  );

  // 釘
  const closedPolys = config.walls.filter((w) => w.closed).map((w) => w.points);
  const nailList: Vec2[] = [];
  for (const g of config.nailGroups) {
    for (const p of expandNailGroup(g)) {
      if (g.kind === 'grid') {
        const dr = Math.hypot(p[0] - cx, p[1] - cy);
        if (dr > r.outerRadius) continue;
        if (closedPolys.some((poly) => pointInPolygon(p, poly))) continue;
        if (minDistanceToSegs(p, segs) - config.nailRadius < g.clearance) continue;
      }
      nailList.push(p);
    }
  }

  const nails = new Float64Array(nailList.length * 2);
  nailList.forEach((p, i) => {
    nails[i * 2] = p[0];
    nails[i * 2 + 1] = p[1];
  });
  const segArr = new Float64Array(segs.length * 4);
  const segMat = new Uint8Array(segs.length);
  segs.forEach((s, i) => {
    segArr[i * 4] = s.ax;
    segArr[i * 4 + 1] = s.ay;
    segArr[i * 4 + 2] = s.bx;
    segArr[i * 4 + 3] = s.by;
    segMat[i] = s.mat;
  });

  // 格子への登録。球の半径と1回の移動量の分だけ広めに登録する
  const cell = 16;
  const cols = Math.ceil(config.width / cell);
  const rows = Math.ceil(config.height / cell);
  const reach = ballRadius + maxMove + 1;
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const addBox = (item: number, minX: number, minY: number, maxX: number, maxY: number): void => {
    const c0 = Math.max(0, Math.floor(minX / cell));
    const c1 = Math.min(cols - 1, Math.floor(maxX / cell));
    const r0 = Math.max(0, Math.floor(minY / cell));
    const r1 = Math.min(rows - 1, Math.floor(maxY / cell));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) buckets[row * cols + col].push(item);
    }
  };
  for (let i = 0; i < nailList.length; i++) {
    const [x, y] = nailList[i];
    const e = reach + config.nailRadius;
    addBox(i, x - e, y - e, x + e, y + e);
  }
  segs.forEach((s, i) => {
    addBox(
      -(i + 1),
      Math.min(s.ax, s.bx) - reach,
      Math.min(s.ay, s.by) - reach,
      Math.max(s.ax, s.bx) + reach,
      Math.max(s.ay, s.by) + reach,
    );
  });
  const cellStart = new Int32Array(cols * rows + 1);
  let total = 0;
  for (let c = 0; c < buckets.length; c++) {
    cellStart[c] = total;
    total += buckets[c].length;
  }
  cellStart[buckets.length] = total;
  const cellItems = new Int32Array(total);
  let k = 0;
  for (const b of buckets) for (const item of b) cellItems[k++] = item;

  // 発射位置と向き(時計回りの接線)
  const launchRad = r.launchDeg * DEG;
  const midR = (r.innerRadius + r.outerRadius) / 2;

  return {
    nails,
    nailCount: nailList.length,
    nailRadius: config.nailRadius,
    segs: segArr,
    segMat,
    segCount: segs.length,
    gridCell: cell,
    gridCols: cols,
    gridRows: rows,
    cellStart,
    cellItems,
    heso: { left: hl, right: hr, sensorY, bottom },
    outY: config.outY,
    width: config.width,
    height: config.height,
    rail: {
      cx,
      cy,
      innerRadius: r.innerRadius,
      outerRadius: r.outerRadius,
      launchRad,
      innerEndProgress: (r.launchDeg - r.innerEndDeg) * DEG,
      foulProgress: Math.PI * 2 - (r.startDeg - r.launchDeg + 2) * DEG,
      launchX: cx + midR * Math.cos(launchRad),
      launchY: cy + midR * Math.sin(launchRad),
      dirX: Math.sin(launchRad),
      dirY: -Math.cos(launchRad),
    },
  };
}

export function expandNailGroup(g: NailGroup): Vec2[] {
  switch (g.kind) {
    case 'points':
      return g.points.slice();
    case 'line': {
      const len = Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1]);
      const n = Math.floor(len / g.spacing + 1e-9);
      const pts: Vec2[] = [];
      for (let i = 0; i <= n; i++) {
        const t = n === 0 ? 0 : (i * g.spacing) / len;
        pts.push([g.from[0] + (g.to[0] - g.from[0]) * t, g.from[1] + (g.to[1] - g.from[1]) * t]);
      }
      return pts;
    }
    case 'grid': {
      const pts: Vec2[] = [];
      for (let row = 0; row < g.rows; row++) {
        const shift = row % 2 === 1 ? g.rowShift : 0;
        for (let col = 0; col < g.cols; col++) {
          pts.push([g.origin[0] + shift + col * g.dx, g.origin[1] + row * g.dy]);
        }
      }
      return pts;
    }
  }
}

function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function minDistanceToSegs(p: Vec2, segs: readonly Seg[]): number {
  let best = Infinity;
  for (const s of segs) {
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((p[0] - s.ax) * ex + (p[1] - s.ay) * ey) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p[0] - (s.ax + ex * t), p[1] - (s.ay + ey * t));
    if (d < best) best = d;
  }
  return best;
}
