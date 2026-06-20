import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.medicalstudycat.app',
  appName: 'Medical Studycat',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
