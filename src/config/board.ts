import type { BoardConfig } from '../physics/types.ts';

/**
 * 盤面の配置(オリジナル)。単位は mm、左下が原点、y は上が正。
 *
 * おおまかな流れ:
 * - 球は左下から外レールに沿って上がる。
 * - 弱めの球は左上で盤面に出て、左の釘の森から道釘を通ってヘソへ向かう。
 * - 強い球は上を越えて右ルートへ行き、返しゴムで跳ねてアウトへ落ちる。
 *
 * ヘソの入賞率は、主に道のすき間(こぼし)の幅と、命釘の間隔で調整する。
 */
export const BOARD: BoardConfig = {
  width: 440,
  height: 460,
  nailRadius: 1.0,

  rail: {
    center: [220, 240],
    outerRadius: 215,
    innerRadius: 200,
    startDeg: 242,
    launchDeg: 236,
    innerEndDeg: 135,
    outerEndDeg: 10,
    outerWallEndDeg: -30,
    segmentDeg: 2,
    bumperTip: [412, 266],
  },

  walls: [
    {
      // 液晶と、その上の屋根。屋根の頂点より左に落ちた球は左へ転がる。
      // 下端と道のすき間は球3個分ほど空け、球が2段に重なって詰まらないようにする
      name: '液晶',
      points: [
        [120, 215],
        [120, 385],
        [220, 405],
        [320, 385],
        [320, 215],
      ],
      closed: true,
      material: 'wall',
    },
    {
      // 右ルートの球がヘソへ来ないようにする仕切りと床
      name: '右下の仕切り',
      points: [
        [320, 215],
        [315, 150],
        [390, 115],
      ],
      material: 'wall',
    },
    {
      // 左の釘の森を抜けた球をヘソの方へ運ぶ傾斜の道。
      // 左端は内レールに付け、球がすき間にはまらないようにする
      name: '道(手前)',
      points: [
        [23.1, 205],
        [158.5, 173.8],
      ],
      material: 'wall',
    },
    {
      // 道の終わり近くの部分。手前の道との間に約12.0mmのすき間(こぼし)があり、
      // ゆっくり転がる球はそこから落ちる。入賞率を一番大きく左右する値
      name: '道(奥)',
      points: [
        [170.2, 171.15],
        [188, 167],
      ],
      material: 'wall',
    },
    {
      name: '右下の外壁',
      points: [
        [406.2, 132.5],
        [406.2, 10],
      ],
      material: 'wall',
    },
  ],

  nailGroups: [
    {
      kind: 'grid',
      name: '天釘',
      origin: [130, 425],
      cols: 5,
      rows: 1,
      dx: 18,
      dy: 0,
      rowShift: 0,
      clearance: 13,
    },
    {
      kind: 'grid',
      name: '左の釘の森',
      origin: [30, 370],
      cols: 6,
      rows: 10,
      dx: 17,
      dy: -15,
      rowShift: 8.5,
      clearance: 13,
    },
    {
      kind: 'points',
      name: '寄り釘',
      points: [
        [200, 162],
      ],
    },
    {
      kind: 'points',
      // ヘソの真上の2本。間隔は14.4mm(すき間は球より約2.4mm広い)。広げると入りやすくなる
      name: '命釘',
      points: [
        [212.8, 152],
        [227.2, 152],
      ],
    },
    {
      kind: 'grid',
      name: '右ルートの釘',
      origin: [330, 340],
      cols: 6,
      rows: 6,
      dx: 17,
      dy: -16,
      rowShift: 8.5,
      clearance: 13,
    },
  ],

  heso: {
    x: 220,
    y: 140,
    openingWidth: 14,
    shoulderWidth: 10,
    shoulderDrop: 8,
    depth: 6,
  },

  outY: 30,
};
