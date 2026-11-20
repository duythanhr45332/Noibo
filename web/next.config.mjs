/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  experimental: {
    optimizePackageImports: [
      '@tabler/icons-react',
      'recharts',
      'date-fns',
      'radix-ui',
    ],
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
    proxyClientMaxBodySize: '20mb',
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
