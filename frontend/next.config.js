/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'promouork.com.br', 'api.promouork.com.br'],
  },
  webpack: (config, { isServer, webpack }) => {
    // Ignorar módulos do Node.js tanto no cliente quanto no servidor
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      jsdom: false,
      fs: false,
      path: false,
      crypto: false,
    };

    // Adicionar alias para evitar que o webpack tente resolver canvas
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      'utf-8-validate': false,
      'bufferutil': false,
    };

    // Usar NormalModuleReplacementPlugin para substituir canvas por um módulo vazio no cliente
    if (!isServer) {
      const path = require('path');
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^canvas$/,
          path.resolve(__dirname, 'lib/canvas-stub.js')
        )
      );
    }

    // Ignorar avisos sobre módulos opcionais
    config.ignoreWarnings = [
      { module: /node_modules\/canvas/ },
      { module: /node_modules\/jsdom/ },
      { file: /node_modules\/canvas/ },
      /Failed to parse source map/,
    ];
    
    return config;
  },
}

module.exports = nextConfig

