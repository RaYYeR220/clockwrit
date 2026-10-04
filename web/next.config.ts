import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@wallclock/core'],
  serverExternalPackages: ['timezonecomplete', 'tzdata'],
}

export default nextConfig
