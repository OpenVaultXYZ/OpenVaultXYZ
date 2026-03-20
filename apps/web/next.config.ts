import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openvault/db"],
};

export default nextConfig;
