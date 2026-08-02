import { describe, it, expect } from 'vitest';
import { mulberry32, shuffled } from '../src/engine/rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('differs across seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('shuffles deterministically and preserves elements', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const s1 = shuffled(input, mulberry32(99));
    const s2 = shuffled(input, mulberry32(99));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(input);
    expect(input[0]).toBe(0); // input not mutated
  });
});
