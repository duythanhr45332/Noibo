const {
  isAllowedUploadFile,
  SAFE_INLINE_MIME_TYPES,
} = require('./upload.middleware');

describe('Upload & File Download Security Validation', () => {
  it('accepts valid MIME + matching extension pairs', () => {
    expect(isAllowedUploadFile('application/pdf', 'hoa-don-vat.pdf')).toBe(true);
    expect(isAllowedUploadFile('image/png', 'scan-bbnt.PNG')).toBe(true);
    expect(isAllowedUploadFile('image/jpeg', 'photo.jpg')).toBe(true);
    expect(isAllowedUploadFile('image/jpeg', 'photo.jpeg')).toBe(true);
    expect(isAllowedUploadFile('image/webp', 'preview.webp')).toBe(true);
    expect(
      isAllowedUploadFile(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'bang-ke.xlsx'
      )
    ).toBe(true);
  });

  it('rejects mismatched extension / MIME spoofing and dangerous script file types', () => {
    expect(isAllowedUploadFile('image/png', 'evil.html')).toBe(false);
    expect(isAllowedUploadFile('application/pdf', 'payload.svg')).toBe(false);
    expect(isAllowedUploadFile('application/pdf', 'malware.exe')).toBe(false);
    expect(isAllowedUploadFile('image/svg+xml', 'xss.svg')).toBe(false);
    expect(isAllowedUploadFile('text/html', 'xss.html')).toBe(false);
    expect(isAllowedUploadFile('application/javascript', 'x.js')).toBe(false);
    expect(isAllowedUploadFile('application/pdf', 'noextension')).toBe(false);
  });

  it('allows inline preview only for safe PDF and raster images, forcing attachment for Office docs', () => {
    expect(SAFE_INLINE_MIME_TYPES.has('application/pdf')).toBe(true);
    expect(SAFE_INLINE_MIME_TYPES.has('image/png')).toBe(true);
    expect(SAFE_INLINE_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(SAFE_INLINE_MIME_TYPES.has('image/webp')).toBe(true);
    expect(
      SAFE_INLINE_MIME_TYPES.has(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(false);
    expect(
      SAFE_INLINE_MIME_TYPES.has(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe(false);
    expect(SAFE_INLINE_MIME_TYPES.has('image/svg+xml')).toBe(false);
  });
});
