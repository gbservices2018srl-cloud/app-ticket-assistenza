const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // L'app vive su appgestione.it/ticketassistenza
  basePath: '/ticketassistenza',
  async redirects() {
    return [
      // il vecchio indirizzo onrender.com (radice) porta al nuovo percorso
      { source: '/', destination: '/ticketassistenza', basePath: false, permanent: false },
      // area amministratori: /admin porta all'accesso, che apre il pannello giusto in base al ruolo
      { source: '/admin', destination: '/ticketassistenza', basePath: false, permanent: false },
      { source: '/ticketassistenza/admin', destination: '/ticketassistenza', basePath: false, permanent: false },
    ];
  },
};

module.exports = withPWA(nextConfig);
