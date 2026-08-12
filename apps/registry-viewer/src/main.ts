import { createApp } from "vue";
import { createPinia } from "pinia";
import "./prefs/registerSections";
import App from "./App.vue";

// why: WP-534 / D-24344 — Pinia backs the preferences foundation store under the
// Option-A path (everything in src/prefs/, no new workspace package). The
// registerSections import runs the shared-tier section registrations for their
// side effect before the app mounts, so the store factory can compose them.
const app = createApp(App);
app.use(createPinia());
app.mount("#app");
