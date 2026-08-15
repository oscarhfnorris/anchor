/// <reference types="react-native-css/types" />

/**
 * NativeWind's stylesheet is imported for its side effect, and Metro resolves it via the Tailwind
 * pipeline rather than TypeScript. Without this, `import './global.css'` is a type error.
 */
declare module '*.css';

/**
 * Drizzle emits its migration bundle as JavaScript with a `.sql` import inside it, inlined by
 * babel at build time. Neither has type declarations of its own.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}

declare module '@/db/migrations/migrations' {
  const migrations: {
    journal: {
      entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
    };
    migrations: Record<string, string>;
  };
  export default migrations;
}
