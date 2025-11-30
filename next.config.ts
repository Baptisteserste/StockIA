import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openrouter.ai',
        pathname: '/images/icons/**',
      },
      {
        protocol: 'https',
        hostname: '*.gstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'huggingface.co',
        pathname: '/front/assets/**',
      },
    ],
  },
};

export default nextConfig;
