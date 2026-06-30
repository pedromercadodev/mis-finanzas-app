const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolver alias para web: cuando se importe 'react-native-safe-area-context',
// en web se usará nuestro polyfill en su lugar
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'react-native-safe-area-context') {
      return {
        type: 'sourceFile',
        filePath: require.resolve('./src/utils/web-polyfills.ts'),
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
