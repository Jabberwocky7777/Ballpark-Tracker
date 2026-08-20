/** @type {import('next').NextConfig} */
export default {
  // The app is one container behind a proxy; standalone keeps the image small.
  output: "standalone",
  // Native module. Bundling it produces a broken .node reference at runtime.
  serverExternalPackages: ["better-sqlite3"],
};
