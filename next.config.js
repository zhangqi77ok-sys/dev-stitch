/** @type {import('next').NextConfig} */
// Static export for the GitHub Pages demo only: build with
// DEV_STITCH_STATIC_EXPORT=1 (see scripts/build-pages.sh). The default
// build keeps server routes (incl. /api/crew) and must NOT set this.
const nextConfig =
  process.env.DEV_STITCH_STATIC_EXPORT === "1" ? { output: "export" } : {};
module.exports = nextConfig;
