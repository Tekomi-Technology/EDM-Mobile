// eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo loads config plugins as CommonJS.
const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

/** Google Play lists the app as EDM Tasks; `name` in app.json stays the App Store name, EDM Service. */
module.exports = function withAndroidAppName(config, { name }) {
  return withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name', translatable: 'false' }, _: name }],
      c.modResults
    );
    return c;
  });
};
