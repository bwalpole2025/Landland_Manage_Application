/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server output for container/preview deploys (Docker, Fly, Render).
  output: "standalone",
  eslint: {
    // Lint runs as a dedicated CI step (`npm run lint`), not during the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
