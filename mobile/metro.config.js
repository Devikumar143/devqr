// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude native Android build output artifacts from Metro's file watcher
config.resolver.blockList = [
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/build\/.*/,
];

module.exports = config;

