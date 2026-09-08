import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nametoavatar.com",
        pathname: "/favicon/**",
      },
      {
        protocol: "https",
        hostname: "stayup.lol",
        pathname: "/**",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
