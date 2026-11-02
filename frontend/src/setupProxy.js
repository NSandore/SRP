const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function configureDevelopmentProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3004',
      // Preserve the browser-facing Host header. The API's CSRF protection
      // compares it with Origin, so rewriting Host to 127.0.0.1 would make
      // legitimate LAN/Tailscale development requests look cross-origin.
      changeOrigin: false,
      pathRewrite: {
        '^/api': '',
      },
    })
  );
};
