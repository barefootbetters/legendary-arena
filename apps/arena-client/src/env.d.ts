/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __GIT_SHA__: string;

// why: WP-890 / D-24842 — the local match spike's development-only build flag.
// Only App.vue reads it, through the `typeof import.meta.env` form.
interface ImportMetaEnv {
  readonly VITE_LOCAL_SPIKE?: string;
}
