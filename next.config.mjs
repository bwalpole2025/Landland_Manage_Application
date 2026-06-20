/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint runs as a dedicated CI step (`npm run lint`), not during the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
