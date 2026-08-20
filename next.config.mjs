/** @type {import('next').NextConfig} */
export default {
  // The app is one container behind a proxy; standalone keeps the image small.
  output: "standalone",
  // Native module. Bundling it produces a broken .node reference at runtime.
  //
  // heic-convert is here for the same class of reason: it loads libheif as a
  // wasm bundle through a dynamic require webpack cannot follow, which warns
  // on every compile and risks shipping a bundle that cannot find its own
  // wasm. It is the fallback decoder, so it has to work on the day sharp turns
  // out to have been built without libheif.
  serverExternalPackages: ["better-sqlite3", "heic-convert"],
};
