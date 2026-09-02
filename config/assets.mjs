/**
 * Ordered source manifest for the generated single-file application.
 *
 * Keep the legacy entries first. New runtime code belongs in a named
 * src/features/<feature>/ directory and must be explicitly added here.
 */
export const assetManifest = Object.freeze({
  styles: Object.freeze(["src/styles/app.css"]),
  scripts: Object.freeze(["src/legacy/app.js"]),
});
