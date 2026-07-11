/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 ships a native .node addon that must not be bundled by the
  // server compiler — keep it external so route handlers can require it.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
