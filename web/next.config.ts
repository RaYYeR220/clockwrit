import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@wallclock/core'],
  serverExternalPackages: ['moment-timezone'],
}

export default nextConfig
