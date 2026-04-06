import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.danilop.nightseek',
  appName: 'NightSeek',
  webDir: 'dist',
  server: {
    // Allow loading local vendor scripts
    allowNavigation: ['*'],
  },
  ios: {
    scheme: 'NightSeek',
    backgroundColor: '#070614',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#070614',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_nightseek',
      iconColor: '#0ea5e9',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070614',
    },
  },
};

export default config;
