const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

const SRC_ROOT = path.resolve(__dirname, 'src');
const ASSETS_ROOT = path.resolve(__dirname, 'assets');

// Make sure Metro watches the root assets folder (it's outside src/)
config.watchFolders = [...(config.watchFolders || []), ASSETS_ROOT];

// Extensions Metro should try when resolving without an explicit extension
const EXTENSIONS = [
    '.tsx', '.ts', '.jsx', '.js',
    '/index.tsx', '/index.ts', '/index.jsx', '/index.js',
];

function resolveWithExtension(basePath) {
    if (/\.(tsx?|jsx?|png|jpg|gif|svg|webp)$/.test(basePath)) {
        return basePath;
    }
    for (const ext of EXTENSIONS) {
        const full = basePath + ext;
        if (fs.existsSync(full)) return full;
    }
    return basePath;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith('@/assets/')) {
        const filePath = resolveWithExtension(
            path.resolve(ASSETS_ROOT, moduleName.slice('@/assets/'.length))
        );
        return { type: 'sourceFile', filePath };
    }
    if (moduleName.startsWith('@/')) {
        const filePath = resolveWithExtension(
            path.resolve(SRC_ROOT, moduleName.slice(2))
        );
        return { type: 'sourceFile', filePath };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
