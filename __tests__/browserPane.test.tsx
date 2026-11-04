import {clamp, fitWindow, nextSplitRatio, MAX_SPLIT_RATIO, MIN_SPLIT_RATIO} from '../src/terminal/BrowserWindow';
import {normalizeBrowserAddress, DEFAULT_BROWSER_URL} from '../src/terminal/BrowserPane';

describe('normalizeBrowserAddress', () => {
  it('falls back to the default dev server for empty input', () => {
    expect(normalizeBrowserAddress('   ')).toBe(DEFAULT_BROWSER_URL);
  });

  it('keeps full web addresses', () => {
    expect(normalizeBrowserAddress('https://example.com/a')).toBe('https://example.com/a');
    expect(normalizeBrowserAddress('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('treats a bare port as a local dev server', () => {
    expect(normalizeBrowserAddress('5173')).toBe('http://localhost:5173');
    expect(normalizeBrowserAddress(':8080/app')).toBe('http://localhost:8080/app');
  });

  it('uses http for local hosts and https for everything else', () => {
    expect(normalizeBrowserAddress('localhost:4000')).toBe('http://localhost:4000');
    expect(normalizeBrowserAddress('0.0.0.0:3000')).toBe('http://localhost:3000');
    expect(normalizeBrowserAddress('192.168.1.5:8000')).toBe('http://192.168.1.5:8000');
    expect(normalizeBrowserAddress('example.com')).toBe('https://example.com');
  });
});

describe('browser layout helpers', () => {
  it('limits the split line so neither half disappears', () => {
    expect(nextSplitRatio(0.5, -10_000, 800)).toBe(MIN_SPLIT_RATIO);
    expect(nextSplitRatio(0.5, 10_000, 800)).toBe(MAX_SPLIT_RATIO);
    expect(nextSplitRatio(0.5, 80, 800)).toBeCloseTo(0.6);
    expect(nextSplitRatio(0.5, 80, 0)).toBe(0.5);
  });

  it('keeps the small window on screen and above its minimum size', () => {
    expect(fitWindow({x: 900, y: 900, w: 300, h: 200}, {width: 400, height: 800})).toEqual({x: 100, y: 600, w: 300, h: 200});
    expect(fitWindow({x: -50, y: -50, w: 20, h: 20}, {width: 400, height: 800})).toEqual({x: 0, y: 0, w: 190, h: 140});
    expect(clamp(5, 0, 3)).toBe(3);
  });
});
