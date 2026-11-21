import { describe, it, expect } from 'vitest';
import { isValidImageUrl, sanitizeExt, buildStoragePath } from '../src/core/media.js';

describe('media helpers', () => {
  it('validates safe image URLs and rejects unsafe schemes', () => {
    expect(isValidImageUrl('https://example.com/diagram.png')).toBe(true);
    expect(isValidImageUrl('http://localhost:5173/test.webp')).toBe(true);
    expect(isValidImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
  });

  it('sanitizes extensions and builds user-scoped storage paths', () => {
    expect(sanitizeExt('image/jpeg', 'photo.JPEG')).toBe('jpg');
    expect(sanitizeExt('image/svg+xml', 'chart.svg')).toBe('svg');
    expect(sanitizeExt('', 'diagram.webp')).toBe('webp');
    expect(buildStoragePath('user-123', 'image/png', 'x.png', 'abc')).toBe('user-123/abc.png');
  });
});
