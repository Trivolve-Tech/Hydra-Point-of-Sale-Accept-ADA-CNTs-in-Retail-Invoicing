import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  transpilePackages: [
    "geist",
    "@meshsdk/core",
    "@meshsdk/react",
    "@meshsdk/transaction",
    "@meshsdk/wallet",
    "@meshsdk/common",
    "@meshsdk/provider",
    "@meshsdk/core-csl",
    "@meshsdk/core-cst",
  ],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default config;
