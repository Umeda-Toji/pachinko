import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 公開先のURLが決まっていないため、相対パスで出力する
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // 入賞率の表などを、テストが通ったときも表示する
    silent: false,
  },
});
