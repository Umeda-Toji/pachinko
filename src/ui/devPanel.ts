import type { PhysicsParams } from '../physics/types.ts';

interface SliderDef {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  get: (p: PhysicsParams) => number;
  set: (p: PhysicsParams, v: number) => void;
}

const SLIDERS: readonly SliderDef[] = [
  {
    label: '重力',
    unit: 'mm/s²',
    min: 2000,
    max: 10000,
    step: 100,
    get: (p) => p.gravity,
    set: (p, v) => {
      p.gravity = v;
    },
  },
  {
    label: '釘の反発',
    unit: '',
    min: 0.3,
    max: 0.9,
    step: 0.01,
    get: (p) => p.restitution.nail,
    set: (p, v) => {
      p.restitution.nail = v;
    },
  },
  {
    label: '発射の強さ(最弱)',
    unit: 'mm/s',
    min: 1200,
    max: 2600,
    step: 10,
    get: (p) => p.launcher.minSpeed,
    set: (p, v) => {
      p.launcher.minSpeed = v;
    },
  },
  {
    label: '発射の強さ(最強)',
    unit: 'mm/s',
    min: 2200,
    max: 3600,
    step: 10,
    get: (p) => p.launcher.maxSpeed,
    set: (p, v) => {
      p.launcher.maxSpeed = v;
    },
  },
];

/**
 * 開発中だけ表示する調整パネル。
 * ここで変えた値は保存されない。気に入った値は src/config/physics.ts に書き写す。
 */
export class DevPanel {
  private readonly fpsEl: HTMLElement;
  private readonly ballsEl: HTMLElement;
  private readonly inputs: { def: SliderDef; input: HTMLInputElement; out: HTMLOutputElement }[] = [];
  private frames = 0;
  private since = 0;
  private readonly params: PhysicsParams;
  private readonly defaults: PhysicsParams;

  constructor(
    parent: HTMLElement,
    params: PhysicsParams,
    defaults: PhysicsParams,
    onParamsChange: () => void,
    onResetBalls: () => void,
  ) {
    this.params = params;
    this.defaults = defaults;
    const root = document.createElement('details');
    root.className = 'dev-panel';
    // 狭い画面では盤面を隠さないよう、閉じた状態で始める
    root.open = window.innerWidth >= 700;
    const summary = document.createElement('summary');
    summary.textContent = '調整パネル(開発中のみ)';
    root.appendChild(summary);

    const stats = document.createElement('div');
    stats.className = 'dev-stats';
    this.fpsEl = document.createElement('span');
    this.ballsEl = document.createElement('span');
    stats.append(this.fpsEl, this.ballsEl);
    root.appendChild(stats);

    for (const def of SLIDERS) {
      const row = document.createElement('label');
      row.className = 'dev-row';
      const name = document.createElement('span');
      name.textContent = def.label;
      const out = document.createElement('output');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.addEventListener('input', () => {
        def.set(this.params, Number(input.value));
        this.showValue(def, input, out);
        onParamsChange();
      });
      row.append(name, out, input);
      root.appendChild(row);
      this.inputs.push({ def, input, out });
    }

    const buttons = document.createElement('div');
    buttons.className = 'dev-buttons';
    const resetParams = document.createElement('button');
    resetParams.type = 'button';
    resetParams.textContent = '初期値に戻す';
    resetParams.addEventListener('click', () => {
      for (const { def } of this.inputs) def.set(this.params, def.get(this.defaults));
      this.refresh();
      onParamsChange();
    });
    const resetBalls = document.createElement('button');
    resetBalls.type = 'button';
    resetBalls.textContent = '持ち玉を1,000玉に戻す';
    resetBalls.addEventListener('click', onResetBalls);
    buttons.append(resetParams, resetBalls);
    root.appendChild(buttons);

    parent.appendChild(root);
    this.refresh();
  }

  /** 毎フレーム呼ぶ。fps は0.5秒ごとに書き換える。 */
  frame(now: number, ballsOnBoard: number): void {
    this.frames++;
    if (this.since === 0) this.since = now;
    const dt = now - this.since;
    if (dt >= 500) {
      this.fpsEl.textContent = `${((this.frames * 1000) / dt).toFixed(0)} fps`;
      this.frames = 0;
      this.since = now;
    }
    this.ballsEl.textContent = `盤面の球 ${ballsOnBoard}個`;
  }

  private refresh(): void {
    for (const { def, input, out } of this.inputs) {
      input.value = String(def.get(this.params));
      this.showValue(def, input, out);
    }
  }

  private showValue(def: SliderDef, input: HTMLInputElement, out: HTMLOutputElement): void {
    const v = Number(input.value);
    out.textContent = `${def.step < 1 ? v.toFixed(2) : v.toFixed(0)}${def.unit ? ' ' + def.unit : ''}`;
  }
}
