import type { Holdings } from '../core/holdings.ts';

const ROWS: readonly (readonly [string, string])[] = [
  ['balls', '持ち玉'],
  ['shots', '発射数'],
  ['heso', 'ヘソ入賞'],
  ['cost', '1回転あたりの消費'],
];

/** 持ち玉などの数字を表示する。値が変わったときだけ書き換える。 */
export class Hud {
  private readonly cells = new Map<string, HTMLElement>();
  private readonly last = new Map<string, string>();
  private readonly status: HTMLElement;

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    for (const [key, label] of ROWS) {
      const row = document.createElement('div');
      row.className = `hud-row hud-${key}`;
      const l = document.createElement('span');
      l.className = 'hud-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'hud-value';
      row.append(l, v);
      root.appendChild(row);
      this.cells.set(key, v);
    }
    this.status = document.createElement('div');
    this.status.className = 'hud-status';
    root.appendChild(this.status);
    this.cells.set('status', this.status);
    parent.appendChild(root);
  }

  update(h: Holdings, status: string): void {
    const cost = h.costPerSpin;
    this.put('balls', `${h.balls.toLocaleString('ja-JP')}玉`);
    this.put('shots', h.shots.toLocaleString('ja-JP'));
    this.put('heso', h.hesoCount.toLocaleString('ja-JP'));
    this.put('cost', cost === null ? '-' : `${cost.toFixed(1)}玉`);
    this.put('status', status);
  }

  private put(key: string, text: string): void {
    if (this.last.get(key) === text) return;
    this.last.set(key, text);
    const cell = this.cells.get(key);
    if (cell) cell.textContent = text;
  }
}
