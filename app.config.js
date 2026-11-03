/**
 * app.json plus the Android Google Maps key for the office map (react-native-maps). The key is never in the repo:
 * EAS gives it to the build as GOOGLE_MAPS_ANDROID_KEY (an EAS environment variable). iOS uses Apple Maps, no key.
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY }]
  ]
});
