/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  async rewrites() {
    const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:8081'
    return [
      {
        source: '/api/v1/:path*',
        destination: `${internalApiUrl}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
