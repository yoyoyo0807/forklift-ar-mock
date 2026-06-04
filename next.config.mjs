/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // 動画プロキシ: same-origin でブラウザに提供するため
        source: "/api/simulation",
        destination: "http://localhost:8000/admin/simulation",
      },
    ];
  },
};
export default nextConfig;
