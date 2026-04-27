import { validateUrl, normalizeUrl, isSameOrigin } from '../lib/utils'

describe('validateUrl', () => {
  it('accepts valid https URLs', () => {
    expect(validateUrl('https://example.com').valid).toBe(true)
    expect(validateUrl('https://my-app.vercel.app').valid).toBe(true)
    expect(validateUrl('https://sub.domain.io/path/to/page').valid).toBe(true)
  })

  it('accepts valid http URLs', () => {
    expect(validateUrl('http://localhost:3000').valid).toBe(true)
    expect(validateUrl('http://192.168.1.1').valid).toBe(true)
  })

  it('rejects empty input', () => {
    const result = validateUrl('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects malformed URLs', () => {
    expect(validateUrl('not-a-url').valid).toBe(false)
    expect(validateUrl('ftp://example.com').valid).toBe(false)
    expect(validateUrl('javascript:alert(1)').valid).toBe(false)
    expect(validateUrl('//example.com').valid).toBe(false)
  })

  it('rejects URLs without protocol', () => {
    expect(validateUrl('example.com').valid).toBe(false)
    expect(validateUrl('www.google.com').valid).toBe(false)
  })

  it('provides meaningful error messages', () => {
    const result1 = validateUrl('')
    expect(result1.error).toContain('required')

    const result2 = validateUrl('example.com')
    expect(result2.error).toBeTruthy()

    const result3 = validateUrl('ftp://example.com')
    expect(result3.error).toContain('http')
  })
})

describe('normalizeUrl', () => {
  it('removes trailing slashes', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path')
  })

  it('keeps root slash-free', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('preserves query params', () => {
    const url = 'https://example.com/search?q=test'
    expect(normalizeUrl(url)).toBe(url)
  })

  it('returns input on malformed URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
  })
})

describe('isSameOrigin', () => {
  it('returns true for same-origin URLs', () => {
    expect(isSameOrigin('https://example.com/page', 'https://example.com')).toBe(true)
    expect(isSameOrigin('https://example.com/a/b/c', 'https://example.com')).toBe(true)
  })

  it('returns false for different origins', () => {
    expect(isSameOrigin('https://other.com/page', 'https://example.com')).toBe(false)
    expect(isSameOrigin('https://sub.example.com', 'https://example.com')).toBe(false)
    expect(isSameOrigin('http://example.com', 'https://example.com')).toBe(false)
  })

  it('returns false for malformed URLs', () => {
    expect(isSameOrigin('not-a-url', 'https://example.com')).toBe(false)
  })
})
