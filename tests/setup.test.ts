import { describe, expect, it } from 'vitest';
import { GAME_TITLE } from '../src/title.ts';

// 段階0: テストの仕組みが動くことだけを確かめる
describe('開発環境', () => {
  it('台の名前を読み込める', () => {
    expect(GAME_TITLE).toBe('呪契の騎士');
  });
});
