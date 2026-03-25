const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// resolveRequest runs for every module Metro resolves (overrides standard lookup).
// We use it for two things:
//   1. Pin every require('react') to mobile/node_modules/react (React 19) so that
//      react-native 0.81's Fabric renderer (which uses React.__CLIENT_INTERNALS_DO_NOT_USE…)
//      doesn't accidentally load the React 18 copy hoisted to the workspace root.
//   2. Remap .js imports to .ts/.tsx so Metro resolves TypeScript ESM-style extensions.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Force React 19
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    try {
      const filePath = require.resolve(moduleName, { paths: [projectRoot] });
      return { filePath, type: 'sourceFile' };
    } catch {}
  }

  // 2. .js → .ts/.tsx remapping for lib ESM imports
  if (moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return context.resolveRequest(context, base + ext, platform);
      } catch {}
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
