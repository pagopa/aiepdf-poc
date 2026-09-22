//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the app can be hosted on Azure Static Web Apps by the
  // DX `release-azure-staticapp-v1` pipeline. The build output is `out/`.
  output: 'export',
  reactStrictMode: true,
  // `@pagopa/mui-italia` ships ESM only; Next must transpile it for the server
  // and client bundles.
  transpilePackages: ['@pagopa/mui-italia'],
  images: {
    // Next Image Optimization is not available in a static export.
    unoptimized: true,
  },
};

module.exports = nextConfig;
