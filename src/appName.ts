import { Platform } from 'react-native';

/** The name people see: EDM Tasks on Google Play, EDM Service on the App Store. */
export const APP_NAME = Platform.OS === 'android' ? 'EDM Tasks' : 'EDM Service';
