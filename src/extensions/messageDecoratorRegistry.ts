import type React from 'react';
import type { Message } from '../types';

/**
 * A function registered by an extension to render extra content below a
 * specific chat message. Return `null` to render nothing for a given message.
 */
export type MessageDecorator = (msg: Message) => React.ReactNode | null;

// ─── Registry ────────────────────────────────────────────────────────────────

const _decorators = new Map<string, MessageDecorator>();
const _listeners = new Set<() => void>();

function notify(): void {
  _listeners.forEach((l) => l());
}

/**
 * Registry for extension-contributed message decorators.
 *
 * Extensions call `messageDecoratorRegistry.register(key, decorator)` to add
 * a decorator. `MessageList` subscribes to changes and re-renders when the
 * set of decorators changes.
 */
export const messageDecoratorRegistry = {
  /**
   * Register a decorator function.
   * Returns an unsubscribe function that removes the decorator when called.
   */
  register(key: string, decorator: MessageDecorator): () => void {
    _decorators.set(key, decorator);
    notify();
    return () => {
      _decorators.delete(key);
      notify();
    };
  },

  /** Returns all currently registered decorators in insertion order. */
  getAll(): MessageDecorator[] {
    return Array.from(_decorators.values());
  },

  /**
   * Subscribe to registry changes (decorator added or removed).
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
