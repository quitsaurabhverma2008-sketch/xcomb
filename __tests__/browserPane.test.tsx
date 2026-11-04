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
