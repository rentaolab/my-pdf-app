import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The plugin defaults to `./src/i18n/request.ts`, which is where the
// request-scoped i18n configuration lives in this project.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
