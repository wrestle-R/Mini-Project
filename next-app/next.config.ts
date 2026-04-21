import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  experimental: {
    middlewareClientMaxBodySize: "100mb",
  },
  poweredByHeader: false,
  serverExternalPackages: ["web-ifc"],
};

export default nextConfig;
