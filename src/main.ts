import './style.css';
import { BOARD } from './config/board.ts';
import { GAME } from './config/game.ts';
import { PHYSICS } from './config/physics.ts';
import { FixedStepper } from './core/fixedStep.ts';
import { Holdings } from './core/holdings.ts';
import { Simulation } from './physics/simulation.ts';
import { PhysicsEvent } from './physics/world.ts';
import { BoardView } from './render/boardView.ts';
import { GAME_TITLE } from './title.ts';
import { DevPanel } from './ui/devPanel.ts';
import { HandleControl } from './ui/handle.ts';
import { Hud } from './ui/hud.ts';
import { Stopper } from './ui/stopper.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app が見つかりません');

// 画面の骨組み
// PC: 盤面の上に題名と情報を重ね、操作部品は右下に置く
// スマホの縦画面: 上から 題名と情報 → 盤面 → 操作部品 の順に並べる(style.css で切り替え)
app.innerHTML = '';
const topbar = document.createElement('div');
topbar.className = 'topbar';
const title = document.createElement('h1');
title.className = 'title';
title.textContent = GAME_TITLE;
topbar.appendChild(title);
const stage = document.createElement('div');
stage.className = 'stage';
const canvas = document.createElement('canvas');
canvas.className = 'board-canvas';
stage.appendChild(canvas);
const controls = document.createElement('div');
controls.className = 'controls';
app.append(topbar, stage, controls);

// 物理(調整パネルで書き換えられるよう、設定の写しを使う)
const params = structuredClone(PHYSICS);
const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
const sim = new Simulation(seed, BOARD, params);
const holdings = new Holdings(GAME.initialBalls, GAME.prize.heso);
sim.world.listener = (type) => {
  if (type === PhysicsEvent.Launch) holdings.onLaunch();
  else if (type === PhysicsEvent.Foul) holdings.onFoul();
  else if (type === PhysicsEvent.Heso) holdings.onHeso();
};

// 描画と操作
const view = new BoardView(canvas, sim.world, BOARD);
const hud = new Hud(topbar);
const handle = new HandleControl(controls);
const stopper = new Stopper(controls);

let devPanel: DevPanel | null = null;
if (import.meta.env.DEV) {
  // 開発中だけ、ブラウザの開発者ツールから状態を調べられるようにする
  (window as unknown as { __debug: unknown }).__debug = { sim, holdings, handle, stopper, params };
  devPanel = new DevPanel(
    document.body,
    params,
    PHYSICS,
    () => sim.world.applyParams(),
    () => holdings.reset(),
  );
}

const resize = (): void => {
  const r = stage.getBoundingClientRect();
  // 操作部品が盤面に重なる配置(PC)のときは、その分を右に空ける
  const overlay = getComputedStyle(controls).position === 'absolute';
  const reserve = overlay ? controls.getBoundingClientRect().width + 40 : 0;
  view.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)), reserve);
};
new ResizeObserver(resize).observe(stage);
resize();

// 計算は 1/240 秒ずつ。1フレームで進めるのは最大0.25秒分まで
const stepper = new FixedStepper(params.stepSeconds, 60);
const physicsStep = (): void => {
  sim.launcher.handle = handle.value;
  sim.launcher.firing = handle.value > 0 && !stopper.pressed && holdings.canFire();
  sim.step();
};

let last = performance.now();
const frame = (now: number): void => {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  stepper.advance(elapsed, physicsStep);
  view.render();

  let status = '';
  if (!holdings.canFire()) status = '持ち玉がありません';
  else if (handle.value === 0) status = 'ハンドルを回すと発射します';
  else if (stopper.pressed) status = 'ストップ中';
  hud.update(holdings, status);
  devPanel?.frame(now, sim.world.ballCount);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
