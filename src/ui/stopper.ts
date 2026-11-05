/**
 * ストッパー。押している間だけ発射を止める。
 * PCはスペースキー、スマホは画面のボタン(PCでもクリックで使える)。
 */
export class Stopper {
  private keyDown = false;
  private readonly pointers = new Set<number>();
  readonly button: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'stopper';
    this.button.textContent = 'ストップ';
    parent.appendChild(this.button);

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      this.keyDown = true;
      this.update();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return;
      this.keyDown = false;
      this.update();
    });
    // 別の窓に移ったときに押しっぱなしにならないようにする
    window.addEventListener('blur', () => {
      this.keyDown = false;
      this.pointers.clear();
      this.update();
    });
    this.button.addEventListener('pointerdown', (e) => {
      this.pointers.add(e.pointerId);
      this.button.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.update();
    });
    const release = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      this.update();
    };
    this.button.addEventListener('pointerup', release);
    this.button.addEventListener('pointercancel', release);
  }

  get pressed(): boolean {
    return this.keyDown || this.pointers.size > 0;
  }

  private update(): void {
    this.button.classList.toggle('active', this.pressed);
  }
}
