import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // agent-readable copies: serve Markdown and text with explicit types so LLM clients parse them as text
  async headers() {
    const md = { key: "Content-Type", value: "text/markdown; charset=utf-8" };
    const txt = { key: "Content-Type", value: "text/plain; charset=utf-8" };
    const cache = { key: "Cache-Control", value: "public, max-age=300" };
    return [
      { source: "/:file*.md", headers: [md, cache] },
      { source: "/llms.txt", headers: [txt, cache] },
      { source: "/llms-full.txt", headers: [txt, cache] },
      { source: "/code/:path*", headers: [txt, cache] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
