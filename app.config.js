/**
 * app.json plus the Android Google Maps key for the office map (react-native-maps). The key is never in the repo:
 * EAS gives it to the build as GOOGLE_MAPS_ANDROID_KEY (an EAS environment variable). iOS uses Apple Maps, no key.
 * extra.googleMapsKey tells the app whether the key was there, so a build without it shows no map instead of closing.
 */
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;
  return {
    ...config,
    extra: { ...config.extra, googleMapsKey: Boolean(key) },
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: key }]]
  };
};
