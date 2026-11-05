import * as THREE from 'three';
import { MAT_BUMPER, MAT_FLAP, MAT_RAIL, type BuiltBoard } from '../physics/board.ts';
import type { BoardConfig } from '../physics/types.ts';
import type { PhysicsWorld } from '../physics/world.ts';

/** 仮の色。見た目の作り込みは段階2で行う。 */
const COLORS = {
  background: 0x0b0708,
  board: 0x1d1a24,
  lcd: 0x08080d,
  lcdEdge: 0x5a2630,
  nail: 0xc9a54a,
  wall: 0x8a8f98,
  rail: 0xc8ccd4,
  bumper: 0xd2662a,
  heso: 0x3fbf6f,
  ball: 0xe8eaee,
};

/** 盤面の手前に置く物の高さ(mm) */
const WALL_HEIGHT = 8;
const NAIL_HEIGHT = 12;

/**
 * 正面固定の視点で、盤面、釘、壁、球を描く。
 * 釘と球は InstancedMesh でまとめて描き、毎フレーム新しいオブジェクトを作らない。
 */
export class BoardView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly balls: THREE.InstancedMesh;
  private readonly tmp = new THREE.Matrix4();
  private readonly world: PhysicsWorld;
  /** 盤面の中心と大きさ(mm)。カメラを合わせるのに使う */
  private readonly center: THREE.Vector2;
  private readonly size: THREE.Vector2;

  constructor(canvas: HTMLCanvasElement, world: PhysicsWorld, config: BoardConfig) {
    this.world = world;
    const board = world.board;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(COLORS.background);

    const r = config.rail;
    this.center = new THREE.Vector2(r.center[0], r.center[1]);
    this.size = new THREE.Vector2(r.outerRadius * 2 + 20, r.outerRadius * 2 + 20);

    this.camera = new THREE.PerspectiveCamera(30, 1, 10, 5000);

    // 光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(this.center.x - 300, this.center.y + 500, 700);
    this.scene.add(key);

    // 盤面の板
    const boardDisc = new THREE.Mesh(
      new THREE.CircleGeometry(r.outerRadius + 6, 96),
      new THREE.MeshStandardMaterial({ color: COLORS.board, roughness: 0.9 }),
    );
    boardDisc.position.set(r.center[0], r.center[1], -0.5);
    this.scene.add(boardDisc);

    // 液晶などの閉じた壁は、中を塗りつぶす
    for (const w of config.walls) {
      if (!w.closed) continue;
      const shape = new THREE.Shape(w.points.map((p) => new THREE.Vector2(p[0], p[1])));
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: COLORS.lcd, emissive: COLORS.lcdEdge, emissiveIntensity: 0.15 }),
      );
      mesh.position.z = 0.2;
      this.scene.add(mesh);
    }

    this.scene.add(this.buildWalls(board));
    this.scene.add(this.buildNails(board));
    this.scene.add(this.buildHesoMark(board));

    // 球
    this.balls = new THREE.InstancedMesh(
      new THREE.SphereGeometry(world.params.ballRadius, 20, 14),
      new THREE.MeshStandardMaterial({ color: COLORS.ball, metalness: 0.9, roughness: 0.25 }),
      world.maxBalls,
    );
    this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.balls.count = 0;
    this.balls.frustumCulled = false;
    this.scene.add(this.balls);
  }

  /**
   * 表示の大きさに合わせて、盤面全体が入るようにカメラを置く。
   * reserveRight は右側に空けておく幅(ピクセル)。操作部品と盤面が重ならないようにする。
   */
  resize(width: number, height: number, reserveRight = 0): void {
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const fov = (this.camera.fov * Math.PI) / 180;
    const usable = Math.max(1, width - reserveRight);
    const needH = Math.max(this.size.y, (this.size.x * height) / usable);
    const dist = needH / 2 / Math.tan(fov / 2);
    // 盤面の中心を、空けた分の半分だけ左へずらして見せる
    const worldPerPixel = needH / Math.max(1, height);
    const shiftX = (reserveRight / 2) * worldPerPixel;
    this.camera.position.set(this.center.x + shiftX, this.center.y, dist);
    this.camera.lookAt(this.center.x + shiftX, this.center.y, 0);
    this.camera.updateProjectionMatrix();
  }

  /** 球の位置を写して描く。 */
  render(): void {
    const w = this.world;
    const z = w.params.ballRadius;
    let n = 0;
    for (let i = 0; i < w.maxBalls; i++) {
      if (!w.active[i]) continue;
      this.tmp.makeTranslation(w.x[i], w.y[i], z);
      this.balls.setMatrixAt(n++, this.tmp);
    }
    this.balls.count = n;
    this.balls.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  private buildWalls(board: BuiltBoard): THREE.Group {
    const group = new THREE.Group();
    const byMat = new Map<number, number[]>();
    for (let s = 0; s < board.segCount; s++) {
      const m = board.segMat[s];
      if (m === MAT_FLAP) continue; // 弁は見えない扱い
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m)!.push(s);
    }
    const geom = new THREE.BoxGeometry(1, 1.6, WALL_HEIGHT);
    const dummy = new THREE.Object3D();
    for (const [mat, list] of byMat) {
      const color = mat === MAT_RAIL ? COLORS.rail : mat === MAT_BUMPER ? COLORS.bumper : COLORS.wall;
      const mesh = new THREE.InstancedMesh(
        geom,
        new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }),
        list.length,
      );
      list.forEach((s, k) => {
        const ax = board.segs[s * 4];
        const ay = board.segs[s * 4 + 1];
        const bx = board.segs[s * 4 + 2];
        const by = board.segs[s * 4 + 3];
        const len = Math.hypot(bx - ax, by - ay);
        dummy.position.set((ax + bx) / 2, (ay + by) / 2, WALL_HEIGHT / 2);
        dummy.rotation.set(0, 0, Math.atan2(by - ay, bx - ax));
        // 継ぎ目にすき間が見えないよう、少しだけ長くする
        dummy.scale.set(len + 0.8, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
      });
      group.add(mesh);
    }
    return group;
  }

  private buildNails(board: BuiltBoard): THREE.InstancedMesh {
    const geom = new THREE.CylinderGeometry(board.nailRadius, board.nailRadius, NAIL_HEIGHT, 10);
    geom.rotateX(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(
      geom,
      new THREE.MeshStandardMaterial({ color: COLORS.nail, metalness: 0.8, roughness: 0.3 }),
      board.nailCount,
    );
    const m = new THREE.Matrix4();
    for (let i = 0; i < board.nailCount; i++) {
      m.makeTranslation(board.nails[i * 2], board.nails[i * 2 + 1], NAIL_HEIGHT / 2);
      mesh.setMatrixAt(i, m);
    }
    return mesh;
  }

  /** ヘソの入口が分かるよう、色の付いた板を置く。 */
  private buildHesoMark(board: BuiltBoard): THREE.Mesh {
    const h = board.heso;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(h.right - h.left, h.sensorY - h.bottom),
      new THREE.MeshStandardMaterial({ color: COLORS.heso, emissive: COLORS.heso, emissiveIntensity: 0.4 }),
    );
    mesh.position.set((h.left + h.right) / 2, (h.sensorY + h.bottom) / 2, 0.3);
    return mesh;
  }
}
