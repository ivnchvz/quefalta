import type { NextConfig } from "next";

// Server routes that read data from disk: the INEGI datasets (public/data) and pdfkit's font metrics.
const DISK_DATA = ["./public/data/**/*", "./node_modules/pdfkit/js/data/**/*", "./src/fonts/**/*"];

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit"],
  // Make sure those files ship with the serverless functions on Vercel.
  outputFileTracingIncludes: {
    "/api/plan-pdf": DISK_DATA,
    "/api/wa-bot": DISK_DATA,
  },
};

export default nextConfig;
