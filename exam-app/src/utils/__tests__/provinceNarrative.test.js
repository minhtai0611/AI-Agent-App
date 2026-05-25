import { describe, it, expect } from 'vitest'
import { getProvinceNarrative } from '../provinceNarrative.js'

describe('getProvinceNarrative', () => {
  it('returns null when provinceData is null', () => {
    expect(getProvinceNarrative(null)).toBeNull()
  })

  it('returns null when provinceData is undefined', () => {
    expect(getProvinceNarrative(undefined)).toBeNull()
  })

  it('returns object with required keys', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: 85, province: 'Hà Nội' })
    expect(result).toHaveProperty('headline')
    expect(result).toHaveProperty('detail')
    expect(result).toHaveProperty('badge')
    expect(result).toHaveProperty('sentiment')
  })

  it('sentiment is above when your_avg > province_avg', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: 85, province: 'Hà Nội' })
    expect(result.sentiment).toBe('above')
  })

  it('sentiment is below when your_avg < province_avg', () => {
    const result = getProvinceNarrative({ your_avg: 6, province_avg: 7, percentile: 40, province: 'Hà Nội' })
    expect(result.sentiment).toBe('below')
  })

  it('sentiment is equal when your_avg equals province_avg', () => {
    const result = getProvinceNarrative({ your_avg: 7, province_avg: 7, percentile: 50, province: 'Hà Nội' })
    expect(result.sentiment).toBe('equal')
  })

  it('headline contains province name when above', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: 85, province: 'Hà Nội' })
    expect(result.headline).toContain('Hà Nội')
  })

  it('headline is a non-empty string', () => {
    const result = getProvinceNarrative({ your_avg: 6, province_avg: 7, percentile: 40, province: 'TP HCM' })
    expect(typeof result.headline).toBe('string')
    expect(result.headline.length).toBeGreaterThan(0)
  })

  it('detail is a non-empty string', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: 85, province: 'Hà Nội' })
    expect(typeof result.detail).toBe('string')
    expect(result.detail.length).toBeGreaterThan(0)
  })

  it('detail contains your_avg and province_avg values', () => {
    const result = getProvinceNarrative({ your_avg: 8.5, province_avg: 7.2, percentile: 85, province: 'Hà Nội' })
    expect(result.detail).toContain('8.5')
    expect(result.detail).toContain('7.2')
  })

  it('badge shows Top X% when percentile is provided', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: 85, province: 'Hà Nội' })
    expect(result.badge).toBe('Top 15%')
  })

  it('badge shows Top 0% when percentile is 100', () => {
    const result = getProvinceNarrative({ your_avg: 10, province_avg: 7, percentile: 100, province: 'Hà Nội' })
    expect(result.badge).toBe('Top 0%')
  })

  it('badge is null when percentile is null', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, percentile: null, province: 'Hà Nội' })
    expect(result.badge).toBeNull()
  })

  it('badge is null when percentile is undefined', () => {
    const result = getProvinceNarrative({ your_avg: 8, province_avg: 7, province: 'Hà Nội' })
    expect(result.badge).toBeNull()
  })
})
