/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Docker 部署时使用
  transpilePackages: ['@neo4j-nvl/react', '@neo4j-nvl/base'],
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
};

module.exports = nextConfig;
