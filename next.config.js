const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // area amministratori: /admin porta all'accesso, che apre il pannello giusto in base al ruolo
      { source: '/admin', destination: '/', permanent: false },
    ];
  },
};

module.exports = withPWA(nextConfig);
