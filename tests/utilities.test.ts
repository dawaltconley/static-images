/// <reference types="../types/common/index" />

import {
  parseSizes,
  deviceImages,
  widthsFromSizes,
  queriesFromSizes,
  filterSizes,
} from '../src/utilities'

describe('parseSizes()', () => {
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
            mediaFeature: 'max-width',
            value: '680px',
          },
        ],
        width: '100vw',
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

  test('parses combined media queries with the "and" keyword', () => {
    expect(
      parseSizes('(max-width: 780px) and (max-height: 720px) 600px, 400px')
    ).toEqual([
      {
        conditions: [
          {
            mediaFeature: 'max-width',
            value: '780px',
          },
          {
            mediaFeature: 'max-height',
            value: '720px',
          },
        ],
        width: '600px',
      },
      { conditions: [], width: '400px' },
    ])
  })
})

describe('deviceImages()', () => {
  type Test = {
    device: Device
    images: Query.Image[]
  }

  let template: {
    sizes: SizesQuery.Object[]
    pass: Test
    fail: Test
  } = {
    sizes: [
      {
        conditions: [
          {
            mediaFeature: 'min-width',
            value: '680px',
          },
        ],
        width: '400px',
      },
      { conditions: [], width: '500px' },
    ],
    pass: {
      device: {
        w: 800,
        h: 700,
        dppx: [1],
        flip: false,
      },
      images: [
        {
          w: 400,
          dppx: 1,
          orientation: 'landscape',
        },
      ],
    },
    fail: {
      device: {
        w: 500,
        h: 600,
        dppx: [1],
        flip: false,
      },
      images: [
        {
          w: 500,
          dppx: 1,
          orientation: 'portrait',
        },
      ],
    },
  }

  test('matches basic min-width query', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes[0].conditions[0].mediaFeature = 'min-width'
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('matches basic min-height query', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes[0].conditions[0].mediaFeature = 'min-height'
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('matches basic max-width query', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes[0].conditions[0].mediaFeature = 'max-width'
    // invert pass and fail widths for max conditions
    pass.images[0].w = 500
    fail.images[0].w = 400
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('matches basic max-height query', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes[0].conditions[0].mediaFeature = 'max-height'
    // invert pass and fail widths for max conditions
    pass.images[0].w = 500
    fail.images[0].w = 400
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('uses 100vw as default fallback value if none is provided', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes.pop()
    fail.device.w = 555
    fail.images[0].w = fail.device.w
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('determines image width using vw and dppx', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes = [
      {
        conditions: [
          {
            mediaFeature: 'min-width',
            value: '680px',
          },
        ],
        width: '50vw',
      },
      { conditions: [], width: '75vw' },
    ]
    // pass remains the same, 400px
    fail = {
      device: {
        ...fail.device,
        dppx: [2, 1],
      },
      images: [
        {
          w: 750,
          dppx: 2,
          orientation: 'portrait',
        },
        {
          w: 375,
          dppx: 1,
          orientation: 'portrait',
        },
      ],
    }

    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('rounds up subpixels', () => {
    let { sizes, pass, fail } = structuredClone(template)
    sizes[0].width = '399.2px'
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('returns images using multiple conditions', () => {
    let sizes: SizesQuery.Object[] = [
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
    ]
    let device: Device = {
      w: 1000,
      h: 400,
      dppx: [1],
      flip: false,
    }
    let image: Query.Image = {
      w: 1000,
      dppx: 1,
      orientation: 'landscape',
    }
    expect(deviceImages(sizes, { ...device, w: 1920 })).toEqual([
      { ...image, w: 719 },
    ])
    expect(deviceImages(sizes, { ...device, w: 1440 })).toEqual([
      { ...image, w: 590 },
    ])
    expect(deviceImages(sizes, { ...device, w: 1200 })).toEqual([
      { ...image, w: 468 },
    ])
    expect(deviceImages(sizes, { ...device, w: 820 })).toEqual([
      { ...image, w: 704 },
    ])
    expect(deviceImages(sizes, { ...device, w: 680 })).toEqual([
      { ...image, w: 576 },
    ])
    expect(deviceImages(sizes, { ...device, w: 600 })).toEqual([
      { ...image, w: 600 },
    ])
  })

  test('handles multiple "and" media queries', () => {
    let sizes: SizesQuery.Object[] = [
      {
        conditions: [
          {
            mediaFeature: 'max-width',
            value: '780px',
          },
          {
            mediaFeature: 'max-height',
            value: '720px',
          },
        ],
        width: '600px',
      },
      { conditions: [], width: '400px' },
    ]
    let pass: Test = {
      device: {
        w: 600,
        h: 480,
        dppx: [1],
        flip: false,
      },
      images: [
        {
          w: 600,
          dppx: 1,
          orientation: 'landscape',
        },
      ],
    }
    // fail with height
    let fail1: Test = {
      device: {
        w: 800,
        h: 600,
        dppx: [1],
        flip: false,
      },
      images: [
        {
          w: 400,
          dppx: 1,
          orientation: 'landscape',
        },
      ],
    }
    // fail with width
    let fail2: Test = {
      ...fail1,
      device: {
        ...fail1.device,
        w: 772,
        h: 728,
      },
    }
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail1.device)).toEqual(fail1.images)
    expect(deviceImages(sizes, fail2.device)).toEqual(fail2.images)
  })

  test('handles a device with multiple resolutions', () => {
    let { sizes, pass, fail } = structuredClone(template)
    pass.device.dppx = [4, 3.2, 2.0, 1.5, 1]
    pass.images = [
      {
        w: 1600,
        dppx: 4,
        orientation: 'landscape',
      },
      {
        w: 1280,
        dppx: 3.2,
        orientation: 'landscape',
      },
      {
        w: 800,
        dppx: 2,
        orientation: 'landscape',
      },
      {
        w: 600,
        dppx: 1.5,
        orientation: 'landscape',
      },
      {
        w: 400,
        dppx: 1,
        orientation: 'landscape',
      },
    ]
    fail.device.dppx = [4, 3.2, 2, 1.5, 1]
    fail.images = [
      {
        w: 2000,
        dppx: 4,
        orientation: 'portrait',
      },
      {
        w: 1600,
        dppx: 3.2,
        orientation: 'portrait',
      },
      {
        w: 1000,
        dppx: 2,
        orientation: 'portrait',
      },
      {
        w: 750,
        dppx: 1.5,
        orientation: 'portrait',
      },
      {
        w: 500,
        dppx: 1,
        orientation: 'portrait',
      },
    ]

    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })

  test('handles a flippable device', () => {
    let { sizes, pass, fail } = structuredClone(template)
    pass.device.flip = true
    pass.images = [
      ...pass.images,
      {
        w: 400,
        dppx: 1,
        orientation: 'portrait',
      },
    ]
    fail.device = {
      ...fail.device,
      h: 800,
      flip: true,
    }
    fail.images = [
      ...fail.images,
      {
        w: 400,
        dppx: 1,
        orientation: 'landscape',
      },
    ]
    expect(deviceImages(sizes, pass.device)).toEqual(pass.images)
    expect(deviceImages(sizes, fail.device)).toEqual(fail.images)
  })
})

describe('filterSizes()', () => {
  const sampleWidths: number[] = [
    200, 250, 380, 800, 801, 1000, 1050, 1100, 1440, 1900, 2000,
  ]
  test('filters similar widths by a default scaling factor', () => {
    expect(filterSizes(sampleWidths)).toEqual([
      2000, 1440, 1100, 801, 380, 250, 200,
    ])
  })
  test('filters more widths with a stricter scaling factor', () => {
    expect(filterSizes(sampleWidths, 0.6)).toEqual([
      2000, 1440, 1100, 801, 380, 250,
    ])
    expect(filterSizes(sampleWidths, 0.5)).toEqual([2000, 1100, 380, 250])
  })

  const sampleDevices: Dimension[] = [
    { w: 200, h: 200 },
    { w: 250, h: 500 },
    { w: 380, h: 2000 },
    { w: 800, h: 450 },
    { w: 801, h: 450 },
    { w: 1000, h: 562.5 },
    { w: 1050, h: 600 },
    { w: 1100, h: 600 },
    { w: 1440, h: 810 },
    { w: 1900, h: 1600 },
    { w: 2000, h: 1125 },
  ]
  test('filters a list of dimensions by their total area', () => {
    expect(filterSizes(sampleDevices)).toEqual([
      { w: 1900, h: 1600 },
      { w: 2000, h: 1125 },
      { w: 1440, h: 810 },
      { w: 380, h: 2000 },
      { w: 1000, h: 562.5 },
      { w: 801, h: 450 },
      { w: 250, h: 500 },
      { w: 200, h: 200 },
    ])
  })
  test('filters more devices with a stricter scaling factor', () => {
    expect(filterSizes(sampleDevices, 0.7)).toEqual([
      { w: 1900, h: 1600 },
      { w: 1440, h: 810 },
      { w: 380, h: 2000 },
      { w: 801, h: 450 },
      { w: 250, h: 500 },
      { w: 200, h: 200 },
    ])
    expect(filterSizes(sampleDevices, 0.35)).toEqual([
      { w: 1900, h: 1600 },
      { w: 380, h: 2000 },
      { w: 250, h: 500 },
      { w: 200, h: 200 },
    ])
  })

  test('filters no items with a scaling factor of 1', () => {
    const sortedWidths = [...sampleWidths].sort((a, b) => b - a)
    const sortedDevices = [...sampleDevices].sort(
      (a, b) => b.w * b.h - a.w * a.h
    )
    expect(filterSizes(sampleWidths, 1)).toEqual(sortedWidths)
    expect(filterSizes(sampleDevices, 1)).toEqual(sortedDevices)
  })
})

describe('widthsFromSizes()', () => {
  // test('image widths using the default devices', () => {
  // })
})
