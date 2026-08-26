/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native Node module (the D-10 store) — keep it external
  // to the server bundle so Next loads it via require() at runtime.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
