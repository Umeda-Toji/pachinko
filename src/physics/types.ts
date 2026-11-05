/**
 * 盤面と物理の設定の形。値そのものは src/config/ に置く。
 * 単位は mm と 秒。座標は盤面の左下が原点で、x は右、y は上が正。
 */

export type Vec2 = readonly [number, number];

/** 当たったときの跳ね返り方の種類。 */
export type Material = 'wall' | 'rail' | 'bumper';

/** 釘の並べ方。どれも数値だけで位置を変えられる。 */
export type NailGroup =
  | {
      /** 座標を1本ずつ書く */
      kind: 'points';
      name: string;
      points: readonly Vec2[];
    }
  | {
      /** from から to へ、spacing の間隔で一直線に並べる */
      kind: 'line';
      name: string;
      from: Vec2;
      to: Vec2;
      spacing: number;
    }
  | {
      /**
       * 格子状に並べる。奇数段は rowShift だけ横にずらす。
       * 壁や液晶に近すぎる釘、レールの外の釘は自動で除く。
       */
      kind: 'grid';
      name: string;
      origin: Vec2;
      cols: number;
      rows: number;
      dx: number;
      dy: number;
      rowShift: number;
      /** 壁と釘のすき間がこの値(mm)未満なら、その釘を置かない */
      clearance: number;
    };

export interface WallDef {
  name: string;
  points: readonly Vec2[];
  /** true なら最後の点と最初の点もつなぐ */
  closed?: boolean;
  material: Material;
}

export interface RailConfig {
  /** レールの円の中心 */
  center: Vec2;
  /** 外レールの半径。球はこの内側を走る */
  outerRadius: number;
  /** 内レールの半径。外レールとの間が発射の通り道 */
  innerRadius: number;
  /** レールの下端の角度(度)。反時計回りが正で、右が0度 */
  startDeg: number;
  /** 球を置く角度(度) */
  launchDeg: number;
  /** 内レールが終わる角度(度)。ここから先で球が盤面に出る */
  innerEndDeg: number;
  /** 外レール(なめらかな部分)が終わる角度(度) */
  outerEndDeg: number;
  /** 外レールの後に続く、ただの壁が終わる角度(度) */
  outerWallEndDeg: number;
  /** 円を何度ごとの直線で近似するか */
  segmentDeg: number;
  /** 外レールの終わりにある返しゴム。先端の座標 */
  bumperTip: Vec2;
}

export interface HesoConfig {
  /** 入口の中心の x */
  x: number;
  /** 入口の上端の y */
  y: number;
  /** 入口の内側の幅(mm)。球の直径11mmより広くする */
  openingWidth: number;
  /** 入口の両肩の張り出し(mm) */
  shoulderWidth: number;
  /** 肩の下がり(mm) */
  shoulderDrop: number;
  /** 入口の深さ(mm)。この分だけ球の中心が下がると入賞 */
  depth: number;
}

export interface BoardConfig {
  width: number;
  height: number;
  nailRadius: number;
  rail: RailConfig;
  walls: readonly WallDef[];
  nailGroups: readonly NailGroup[];
  heso: HesoConfig;
  /** 球の中心がこれより下に来たらアウト */
  outY: number;
}

export interface PhysicsParams {
  /** 計算の間隔(秒) */
  stepSeconds: number;
  /** 細かく分けた1回あたりに、球が進んでよい最大の距離(mm) */
  maxMovePerSubstep: number;
  /** 盤面に沿った重力(mm/s²) */
  gravity: number;
  /** 速さに比例するブレーキ(1/秒)。空気と転がりの抵抗のかわり */
  linearDrag: number;
  ballRadius: number;
  ballMassGrams: number;
  /** 盤面に同時に置ける球の数 */
  maxBalls: number;
  /** 反発係数 */
  restitution: { nail: number; wall: number; rail: number; bumper: number; ball: number };
  /** 摩擦(当たったときに横向きの速さをどれだけ削るか) */
  friction: { nail: number; wall: number; rail: number; bumper: number; ball: number };
  /** ぶつかる速さがこれ未満なら跳ねさせない(mm/s)。小刻みな震えを防ぐ */
  restingSpeed: number;
  /** この秒数より長く盤面にいる球は、引っかかったとみなして取り除く */
  stuckSeconds: number;
  launcher: {
    intervalSeconds: number;
    /** ハンドル0のときの発射の速さ(mm/s) */
    minSpeed: number;
    /** ハンドル1のときの発射の速さ(mm/s) */
    maxSpeed: number;
    /** 発射の速さのぶれ。0.01 なら ±1% */
    speedJitter: number;
  };
}
