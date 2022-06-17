import {
  widthsFromSizes,
  queriesFromSizes,
  parseSizes,
  deviceImages,
  filterSizes,
} from '../src/utilities'

describe('parseSizes', () => {
  test('parses media query and assigned width', () => {
    expect(parseSizes('(min-width: 680px) 400px')).toEqual([
      {
        conditions: [
          {
            mediaFeature: 'min-width',
            value: '680px',
          },
        ],
        width: '400px',
      },
    ])
    expect(parseSizes('(max-width: 680px) 100vw')).toEqual([
      {
        conditions: [
          {
            mediaFeature: 'max-with',
            value: '100vw',
          },
        ],
        width: '400px',
      },
    ])
  })
  test('parses media query with fallback value', () => {
    expect(parseSizes('(min-width: 680px) 400px, 100vw')).toEqual([
      {
        conditions: [
          {
            mediaFeature: 'min-width',
            value: '680px',
          },
        ],
        width: '400px',
      },
      { conditions: [], width: '100vw' },
    ])
  })
  test('parses multiple media queries', () => {
    expect(
      parseSizes(
        '(min-width: 1536px) 718.5px, (min-width: 1280px) 590px, (min-width: 1024px) 468px, (min-width: 768px) 704px, (min-width: 640px) 576px, 100vw'
      )
    ).toEqual([
      {
        conditions: [{ mediaFeature: 'min-width', value: '1536px' }],
        width: '718.5px',
      },
      {
        conditions: [{ mediaFeature: 'min-width', value: '1280px' }],
        width: '590px',
      },
      {
        conditions: [{ mediaFeature: 'min-width', value: '1024px' }],
        width: '468px',
      },
      {
        conditions: [{ mediaFeature: 'min-width', value: '768px' }],
        width: '704px',
      },
      {
        conditions: [{ mediaFeature: 'min-width', value: '640px' }],
        width: '576px',
      },
      { conditions: [], width: '100vw' },
    ])
  })
})

// test('filterSizes', () => {
//   let widths = []
//   expect(filterSizes([]))
// })
