import {
  HANDLE_SWEEP_DEG,
  rotateHandle,
  WheelAccumulator,
  wheelDeltaToPixels,
  wrapAngle,
} from './handleMath.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 画面上のハンドル。ドラッグ(指でも可)とマウスホイールで回す。
 * 手を離しても角度はそのまま残る。
 */
export class HandleControl {
  value = 0;
  readonly element: HTMLDivElement;
  private readonly knob: SVGGElement;
  private readonly label: HTMLSpanElement;
  private dragging = -1;
  private lastAngle = 0;
  private readonly wheel = new WheelAccumulator();

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'handle';
    this.element.setAttribute('role', 'slider');
    this.element.setAttribute('aria-label', 'ハンドル');
    this.element.setAttribute('aria-valuemin', '0');
    this.element.setAttribute('aria-valuemax', '1');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-60 -60 120 120');
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('r', '56');
    ring.setAttribute('class', 'handle-ring');
    const range = document.createElementNS(SVG_NS, 'path');
    range.setAttribute('class', 'handle-range');
    range.setAttribute('d', arcPath(50, -90, -90 + HANDLE_SWEEP_DEG));
    svg.append(ring, range);

    this.knob = document.createElementNS(SVG_NS, 'g');
    const knobBody = document.createElementNS(SVG_NS, 'circle');
    knobBody.setAttribute('r', '40');
    knobBody.setAttribute('class', 'handle-knob');
    const mark = document.createElementNS(SVG_NS, 'line');
    mark.setAttribute('x1', '0');
    mark.setAttribute('y1', '-8');
    mark.setAttribute('x2', '0');
    mark.setAttribute('y2', '-36');
    mark.setAttribute('class', 'handle-mark');
    this.knob.append(knobBody, mark);
    svg.appendChild(this.knob);
    this.element.appendChild(svg);

    this.label = document.createElement('span');
    this.label.className = 'handle-value';
    this.element.appendChild(this.label);
    parent.appendChild(this.element);

    this.element.addEventListener('pointerdown', (e) => {
      this.dragging = e.pointerId;
      this.lastAngle = this.pointerAngle(e);
      this.element.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.element.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragging) return;
      const a = this.pointerAngle(e);
      this.set(rotateHandle(this.value, wrapAngle(a - this.lastAngle)));
      this.lastAngle = a;
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId === this.dragging) this.dragging = -1;
    };
    this.element.addEventListener('pointerup', end);
    this.element.addEventListener('pointercancel', end);

    // ホイールは盤面の上でも効くよう、画面全体で受ける(調整パネルの上は除く)
    window.addEventListener(
      'wheel',
      (e) => {
        const target = e.target as Element | null;
        if (target?.closest('.dev-panel')) return;
        e.preventDefault();
        // Shift を押すと、ブラウザによっては縦の回転が横(deltaX)として届く
        const delta = e.deltaY !== 0 ? e.deltaY : e.shiftKey ? e.deltaX : 0;
        this.set(this.wheel.apply(this.value, wheelDeltaToPixels(delta, e.deltaMode), e.shiftKey));
      },
      { passive: false },
    );
    this.set(0);
  }

  set(v: number): void {
    this.value = v;
    // 0 で左、0.5 で真上、1 で右を向く(時計回り)
    this.knob.setAttribute('transform', `rotate(${-90 + v * HANDLE_SWEEP_DEG})`);
    this.label.textContent = v.toFixed(3);
    this.element.setAttribute('aria-valuenow', v.toFixed(3));
  }

  /** ハンドルの中心から見た指の角度(ラジアン、画面では時計回りが正) */
  private pointerAngle(e: PointerEvent): number {
    const r = this.element.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }
}

/** 真上を0度、時計回りを正として、円弧の path を作る。 */
function arcPath(r: number, fromDeg: number, toDeg: number): string {
  const p = (deg: number): string => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };
  return `M ${p(fromDeg)} A ${r} ${r} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${p(toDeg)}`;
}
