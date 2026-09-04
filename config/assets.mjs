/**
 * Ordered source manifest for the generated single-file application.
 *
 * This manifest is frozen with the legacy production track. v2 modules are
 * bundled by Vite and must not be added here.
 */
export const assetManifest = Object.freeze({
  styles: Object.freeze(["src/styles/app.css"]),
  scripts: Object.freeze(["src/legacy/app.js"]),
});
