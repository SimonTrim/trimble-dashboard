const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'TrimbleDashboard',
    libraryTarget: 'umd',
    clean: true,
  },
  externals: {
    // TrimbleConnectWorkspace est chargé via CDN et disponible globalement
    'trimble-connect-workspace-api': 'TrimbleConnectWorkspace',
  },
  devtool: 'source-map',
  mode: 'development',
  plugins: [
    new webpack.DefinePlugin({
      __LICENSE_API_URL__: JSON.stringify(process.env.VITE_LICENSE_API_URL || ''),
      __SKIP_LICENSE__: JSON.stringify(process.env.VITE_SKIP_LICENSE === 'true'),
    }),
  ],
};
