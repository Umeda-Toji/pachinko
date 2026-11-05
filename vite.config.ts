import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 公開先のURLが決まっていないため、相対パスで出力する
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
