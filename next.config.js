/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: require('./src/config/portal.json').basePath,
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
