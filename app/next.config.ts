import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SDK is shipped as TypeScript source from the workspace.
  transpilePackages: ["@selo/sdk"],
};

export default nextConfig;
