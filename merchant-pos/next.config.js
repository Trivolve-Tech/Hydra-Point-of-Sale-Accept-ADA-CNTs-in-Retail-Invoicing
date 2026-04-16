/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
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

  /** Mesh / @meshsdk/core-csl ship `.wasm` for the browser bundle. */
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default config;
