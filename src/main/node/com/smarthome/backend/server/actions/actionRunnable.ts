export class ActionRunnable {
  protected listener?: () => void;
  protected listenerWithParam?: (value: unknown) => void;

  constructor(listener: () => void);
  constructor(listenerWithParam: (value: unknown) => void);
  constructor(callback: (() => void) | ((value: unknown) => void)) {
    if (callback.length === 0) {
      this.listener = callback as () => void;
    } else {
      this.listenerWithParam = callback as (value: unknown) => void;
    }
  }

  run() {
    if (this.listener) {
      this.listener();
    } else if (this.listenerWithParam) {
      this.listenerWithParam(null);
    }
  }

  runWithValue(value: unknown) {
    if (this.listenerWithParam) {
      this.listenerWithParam(value);
    } else if (this.listener) {
      this.listener();
    }
  }
}

