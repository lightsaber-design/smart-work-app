import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ministrylog.app',
  appName: 'MinistryLog',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/drive.appdata",
      ],
      serverClientId: "398912678802-dsfkg3tfkjbkg3d9jpspg1hmv97a5rhu.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#f5f7fa',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      iosSplashResourceName: 'Default',
    },
  },
};

export default config;
