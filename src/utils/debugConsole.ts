/**
 * debugConsole — write to the in-app Debug Console panel from anywhere in the renderer.
 *
 * Usage:
 *   import { debugConsole } from '@openconduit/core';
 *   debugConsole.log('hello');
 *   debugConsole.warn('something odd', { value });
 *   debugConsole.error('boom', err);
 *
 * Pass an optional category to respect per-category logging toggles (Settings › Logging):
 *   debugConsole.info('Request sent', payload, 'provider');
 */
import { useDebugConsoleStore, type LogCategory } from '../stores/debugConsoleStore';

const add = useDebugConsoleStore.getState().addEntry;

export const debugConsole = {
  debug: (message: string, data?: unknown, category?: LogCategory) => useDebugConsoleStore.getState().addEntry('debug', message, data, category),
  log:   (message: string, data?: unknown, category?: LogCategory) => useDebugConsoleStore.getState().addEntry('log',   message, data, category),
  info:  (message: string, data?: unknown, category?: LogCategory) => useDebugConsoleStore.getState().addEntry('info',  message, data, category),
  warn:  (message: string, data?: unknown, category?: LogCategory) => useDebugConsoleStore.getState().addEntry('warn',  message, data, category),
  error: (message: string, data?: unknown, category?: LogCategory) => useDebugConsoleStore.getState().addEntry('error', message, data, category),
};

// Keep `add` import side-effect-free; the line above holds the real reference.
void add;
