import { describe, expect, it } from 'vitest';
import { LineSplitter } from '../../../src/main/solver/runner';

describe('LineSplitter', () => {
  function collect(chunks: string[], flush = true): string[] {
    const lines: string[] = [];
    const splitter = new LineSplitter((line) => lines.push(line));
    for (const chunk of chunks) splitter.feed(chunk);
    if (flush) splitter.flush();
    return lines;
  }

  it('emits whole lines from a single chunk', () => {
    expect(collect(['a\nb\nc\n'])).toEqual(['a', 'b', 'c']);
  });

  it('reassembles lines split across chunk boundaries', () => {
    expect(collect(['loa', 'ding\n  car', 'ds : 13842\n'])).toEqual([
      'loading',
      '  cards : 13842',
    ]);
  });

  it('strips CRLF line endings', () => {
    expect(collect(['a\r\nb\r\n'])).toEqual(['a', 'b']);
  });

  it('holds an unterminated tail until flush', () => {
    expect(collect(['a\ntail'], false)).toEqual(['a']);
    expect(collect(['a\ntail'])).toEqual(['a', 'tail']);
  });

  it('emits empty lines', () => {
    expect(collect(['a\n\nb\n'])).toEqual(['a', '', 'b']);
  });
});
