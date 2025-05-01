const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production', // Change back to production for deployment
  entry: './src/index-simple.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '' // Empty string for relative paths
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index-simple.html',
      filename: 'index.html',
      inject: 'body' // Explicitly inject scripts into body
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  experiments: {
    asyncWebAssembly: true
  }
};
