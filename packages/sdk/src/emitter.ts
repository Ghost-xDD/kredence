/**
 * Tiny typed event emitter — zero dependencies, works in browser and Node.js.
 */

type Listener<T> = (data: T) => void;

export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Array<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const wrapper = (data: Events[K]) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const arr = this.listeners[event];
    if (arr) {
      this.listeners[event] = arr.filter((l) => l !== listener) as Array<Listener<Events[K]>>;
    }
    return this;
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const arr = this.listeners[event];
    if (arr) {
      for (const l of arr) l(data);
    }
  }

  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event !== undefined) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
    return this;
  }
}
