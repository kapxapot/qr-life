import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nametoavatar.com",
        pathname: "/favicon/**",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
