/* No-op replacement for the `server-only` package, used by vitest via the
   resolve.alias entry in vitest.config.ts. The real `server-only` throws at
   import time when bundled into a client component, which we never do — but
   vitest can't detect server context, so it would always throw. */
export {};
