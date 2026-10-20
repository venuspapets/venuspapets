/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Las fotos de mascotas se suben por acciones del servidor (hasta 4 MB).
  experimental: { serverActions: { bodySizeLimit: '5mb' } }
};
