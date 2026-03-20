// capacitor.config.ts

// Signing options are only applied when all required env vars are present (release builds).
const signingOptions =
  process.env.KEYSTORE_PATH &&
  process.env.KEYSTORE_PASSWORD &&
  process.env.KEY_ALIAS &&
  process.env.KEY_PASSWORD
    ? {
        buildOptions: {
          keystorePath: process.env.KEYSTORE_PATH,
          keystorePassword: process.env.KEYSTORE_PASSWORD,
          keystoreAlias: process.env.KEY_ALIAS,
          keystoreAliasPassword: process.env.KEY_PASSWORD,
        },
      }
    : {};

const config = {
  appId: 'com.resonator.quantum',
  appName: '∆Ω-RESONATOR',
  webDir: 'dist',
  plugins: {},
  ios: {
    // iOS specific configuration
  },
  android: {
    // Android specific configuration
    ...signingOptions,
  },
};

export default config;