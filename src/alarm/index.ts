/**
 * The alarm seam.
 *
 * Import `engine` from here, never a platform file directly: the bundler substitutes the right
 * implementation, and depending on `engine.ios` by name would defeat the whole arrangement.
 */
export { engine } from './engine';
export * from './types';
