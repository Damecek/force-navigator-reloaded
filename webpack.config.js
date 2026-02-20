const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const LwcWebpackPlugin = require('lwc-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  const PROD_KEY =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoYbnK/4GIHiHK5i0bZ/7jk8w+ifhmNf4ULA/1LsHpdmN68eobjXLC3LMbZyzN1eXf8WfLSDPI9S9jM/BmCCuPt1ZxCbVSkIfjqfbzWe31NAJjP3UcYXi7ZX57MBXP/7Xj8c5faKiUalBlCm0qyVyGdlB5BhNA/KOFv9+2oIPGoRSTF7ZhiItlQ+wYX3kNhAkRvxi8bJlITqkrZgI8sWPMSNvOccvgvUEXjqxoU6+onDttQz9HGrbPm+XTS1mFPwSN4ZOTReqdQ4TMZqAFs9Ml31ax1pedSNMYsnaOpRTEVyLjDTVPumbhluVPxCPdeHfQjBbk0C0t4GwyyAF2EhDvQIDAQAB';
  const DEV_KEY =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtr+pe1aE1YhsrBtMQO+PGGKgZ7wLjjjxHKP8oP27XLlNpbS4upjuX9IN/RtmZzO71dA5BRTm5kILUggFZOQchVRkP+Yj029BH3FEVKJJx7FvZWG5j+Q8IW1V1GwEWatrFeKCBHdtkp/+qWNniWq+eByviNHNUXF2c1wcztasYSffw0wHL0vjQKrw0Y6isFj6nooyQyT5NNhoJmxY4iSV8rvSFYjadkavkp7Cup1eN79EFcHgL6DOxH9h2UyfXclsD2uFljAiA6orGuTPp6YHiwqpHvRwqrdyIb/KPwroc4l5K+qmR4/nqPzu0sGBRizFC6GyXzU1NO8WPEZrocxiGQIDAQAB';
  const PROD_CLIENT_ID = 'PROD_CONSUMER_KEY';
  const DEV_CLIENT_ID = 'DEV_CONSUMER_KEY';
  return {
    mode: argv.mode,
    devtool: isProd ? false : 'inline-source-map',
    resolve: { extensions: ['.js', '.html'] },
    entry: {
      background: path.resolve(__dirname, 'src/background/index.js'),
      content: path.resolve(__dirname, 'src/content_scripts/content.js'),
      mySalesforceContent: path.resolve(
        __dirname,
        'src/content_scripts/mySalesforceContent.js'
      ),
      popup: path.resolve(__dirname, 'src/popup/popup.js'),
      options: path.resolve(__dirname, 'src/options/options.js'),
      welcome: path.resolve(__dirname, 'src/welcome/welcome.js'),
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
      new webpack.DefinePlugin({
        __CLIENT_ID__: JSON.stringify(isProd ? PROD_CLIENT_ID : DEV_CLIENT_ID),
      }),
      new LwcWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
            /**
             * Inject Chrome extension key and OAuth consumer key based on mode.
             * @param {Buffer} content raw manifest JSON
             * @returns {string} transformed manifest JSON string
             */
            transform(content) {
              const manifest = JSON.parse(content.toString());
              manifest.key = isProd ? PROD_KEY : DEV_KEY;
              manifest.name = manifest.name + (isProd ? '' : ' (Dev)');
              manifest.oauth2.client_id = isProd
                ? PROD_CLIENT_ID
                : DEV_CLIENT_ID;
              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/popup/popup.css', to: 'popup.css' },
          { from: 'src/options/options.html', to: 'options.html' },
          { from: 'src/options/dark-mode.css', to: 'dark-mode.css' },
          { from: 'src/welcome/welcome.html', to: 'welcome.html' },
          { from: 'src/welcome/welcome.css', to: 'welcome.css' },
          {
            from: 'src/welcome/images',
            to: 'images',
            noErrorOnMissing: true,
          },
          {
            from: 'src/content_scripts/lightningNavigation.js',
            to: 'lightningNavigation.js',
          },
          { from: 'src/icons', to: 'icons' },
        ],
      }),
    ],
  };
};
