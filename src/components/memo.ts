import { Component, type ComponentType, h } from 'preact';

/**
 * Skip re-rendering when the props are shallowly equal. Signal-driven updates inside the wrapped component still
 * happen, because the inner component owns those subscriptions.
 */
export function memo<P extends object>(Inner: ComponentType<P>): ComponentType<P> {
  class Memo extends Component<P> {
    shouldComponentUpdate(next: P) {
      const a = this.props as Record<string, unknown>;
      const b = next as Record<string, unknown>;
      for (const key in b) if (b[key] !== a[key]) return true;
      for (const key in a) if (!(key in b)) return true;
      return false;
    }
    render() {
      return h(Inner as ComponentType<Record<string, unknown>>, this.props as Record<string, unknown>);
    }
  }
  return Memo as unknown as ComponentType<P>;
}
