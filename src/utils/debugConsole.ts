/**
 * debugConsole — write to the in-app Debug Console panel from anywhere in the renderer.
 *
 * Usage:
 *   import { debugConsole } from '@openconduit/core';
 *   debugConsole.log('hello');
 *   debugConsole.warn('something odd', { value });
 *   debugConsole.error('boom', err);
 */
import { useDebugConsoleStore } from '../stores/debugConsoleStore';

const add = useDebugConsoleStore.getState().addEntry;

export const debugConsole = {
  debug: (message: string, data?: unknown) => useDebugConsoleStore.getState().addEntry('debug', message, data),
  log:   (message: string, data?: unknown) => useDebugConsoleStore.getState().addEntry('log',   message, data),
  info:  (message: string, data?: unknown) => useDebugConsoleStore.getState().addEntry('info',  message, data),
  warn:  (message: string, data?: unknown) => useDebugConsoleStore.getState().addEntry('warn',  message, data),
  error: (message: string, data?: unknown) => useDebugConsoleStore.getState().addEntry('error', message, data),
};

// Keep `add` import side-effect-free; the line above holds the real reference.
void add;
