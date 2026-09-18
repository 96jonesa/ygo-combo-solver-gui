import { describe, expect, it } from 'vitest';
import { isNewer } from '../../src/main/updates';

describe('isNewer', () => {
  it('detects a higher version in each component', () => {
    expect(isNewer('v0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('v1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('v0.1.1', '0.1.0')).toBe(true);
  });

  it('is false for equal or older versions', () => {
    expect(isNewer('v0.2.0', '0.2.0')).toBe(false);
    expect(isNewer('v0.1.0', '0.2.0')).toBe(false);
    expect(isNewer('0.1.9', '0.2.0')).toBe(false);
  });

  it('tolerates the v prefix on either side', () => {
    expect(isNewer('0.2.0', 'v0.1.0')).toBe(true);
    expect(isNewer('v0.2.0', 'v0.1.0')).toBe(true);
  });

  it('is false (never a false-positive upgrade) for unparseable tags', () => {
    expect(isNewer('nightly', '0.1.0')).toBe(false);
    expect(isNewer('v0.2', '0.1.0')).toBe(false);
    expect(isNewer('v1.0.0-rc1', '0.1.0')).toBe(false);
    expect(isNewer('', '0.1.0')).toBe(false);
  });
});
