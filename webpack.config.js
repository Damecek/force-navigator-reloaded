const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const LwcWebpackPlugin = require('lwc-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    mode: argv.mode,
    devtool: isProd ? false : 'inline-source-map',
    resolve: { extensions: ['.js', '.html'] },
    entry: {
      background: path.resolve(__dirname, 'src/background/index.js'),
      content: path.resolve(__dirname, 'src/content_scripts/content.js'),
      popup: path.resolve(__dirname, 'src/popup.js'),
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
    optimization: isProd
      ? {
          minimize: true,
          minimizer: [
            new TerserPlugin({
              terserOptions: {
                compress: {
                  pure_funcs: [
                    'console.log',
                    'console.info',
                    'console.debug',
                    'console.warn',
                  ],
                },
              },
            }),
          ],
        }
      : {},
    plugins: [
      new LwcWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/manifest.json', to: 'manifest.json' },
          { from: 'src/popup.html', to: 'popup.html' },
          { from: 'src/icons', to: 'icons' },
        ],
      }),
    ],
  };
};
