import mediaParser from 'postcss-media-query-parser'
import defaultDevices from './data/devices'

/** @constant used for parsing a CSS value */
const valueRegex: RegExp = /([\d.]+)(\D*)/

/** Parses a string as a value with an optional unit. */
const cssValue = (v: string): [number, string] => {
  let value: string = v,
    unit: string = ''
  let match = v.match(valueRegex)
  if (match) [, value, unit] = match
  return [Number(value), unit]
}

const isDimension = (object: any): object is Dimension =>
  object &&
  typeof object.w === 'number' &&
  typeof object.h === 'number' &&
  object.dppx === undefined

const isDimensionArray = (array: any[]): array is Dimension[] => {
  for (const item of array) if (!isDimension(item)) return false
  return true
}

/**
 * Takes a parsed img sizes attribute and a specific device,
 * returning the image dimensions needed to support that device.
 *
 * @param sizes
 * @param device - object representing an expected device
 * @param order - whether the widths should be interpreted as 'min' or 'max'
 * @return unique widths that will need to be produced for the given device
 */
function deviceImages(
  sizes: SizesQuery.Object[],
  device: Device /* , order: SizesQuery.Order */
): Query.Image[] {
  let imgWidth: string = '100vw'
  let orientation: Query.Orientation =
    device.w >= device.h ? 'landscape' : 'portrait'

  // TODO fallback on 100vw if no queries apply
  // this is the browser default
  whichSize: for (let { conditions, width } of sizes) {
    for (let { mediaFeature, value: valueString } of conditions) {
      let [value, unit]: [number, string] = cssValue(valueString)
      if (unit !== 'px')
        throw new Error(`Invalid query unit ${unit}: only px is supported`)
      let match: boolean =
        (mediaFeature === 'min-width' && device.w >= value) ||
        (mediaFeature === 'max-width' && device.w <= value) ||
        (mediaFeature === 'min-height' && device.h >= value) ||
        (mediaFeature === 'max-height' && device.h <= value)
      if (!match) continue whichSize
    }
    imgWidth = width
    break whichSize // break loop when device matches all conditions
  }

  let needImages: Query.Image[] = []
  let { dppx } = device
  if (dppx.indexOf(1) < 0) dppx.push(1) // always include a dppx value of one for queries, to avoid upscaling when screen resizes on larger 1dppx displays. TODO any way I can require this as part of the type?

  dppx.forEach(dppx => {
    // TODO handle flipping here...
    let [scaledWidth, unit = 'px'] = cssValue(imgWidth)
    if (unit === 'vw') scaledWidth = (device.w * scaledWidth) / 100
    scaledWidth = Math.ceil(scaledWidth * dppx)
    needImages.push({
      w: scaledWidth,
      dppx,
      orientation,
    })
  })

  if (device.flip)
    needImages = deviceImages(sizes, {
      ...device,
      w: device.h,
      h: device.w,
      flip: false,
    }).concat(needImages)

  return needImages
}

/**
 * @param sizesQueryString - a string representation of a valid img 'sizes' attribute
 * @returns an array of dimensions, which represent image copies that should be produced to satisfy these sizes.
 */

function widthsFromSizes(
  sizesQueryString: SizesQuery.String,
  opt?: Partial<{
    devices: Device[]
    order: SizesQuery.Order
    minScale: number
  }>
): number[] {
  let { devices = defaultDevices, order, minScale } = opt || {}
  let sizes = parseSizes(sizesQueryString)

  let needWidths: Set<number> = devices.reduce((all, device) => {
    deviceImages(sizes, device).forEach(n => all.add(n.w), all)
    return all
  }, new Set<number>())

  let widthsArray: number[] = Array.from(needWidths)

  return filterSizes(widthsArray, minScale)
}

function queriesFromSizes(
  sizesQueryString: SizesQuery.String,
  opt?: Partial<{
    devices: Device[]
    order: SizesQuery.Order
    minScale: number
  }>
): Query.Map {
  let { devices = defaultDevices, order, minScale } = opt || {}
  let sizes = parseSizes(sizesQueryString)

  const queries: Query.Map = {
    landscape: [],
    portrait: [],
  }

  devices.forEach(device => {
    const images: Record<Query.Orientation, Query.Image[]> = {
      landscape: [],
      portrait: [],
    }
    deviceImages(sizes, device).forEach(img =>
      images[img.orientation].push(img)
    )
    if (images.landscape.length)
      queries.landscape.push({
        w: device.w,
        h: device.h,
        images: images.landscape,
      })
    if (images.portrait.length)
      queries.portrait.push({
        w: device.h,
        h: device.w,
        images: images.portrait,
      })
  })

  queries.landscape = queries.landscape.sort((a, b) => b.w - a.w)
  queries.portrait = queries.portrait.sort((a, b) => b.w - a.w)

  return queries // this works, just need to filter
}

/**
 * Filters a dimensions list, returning only dimensions that meet a threshold for downsizing.
 *
 * @param list - an array of dimension objects
 * @param factor - the maximum value for downscaling; i.e. 0.8 means any values that reduce an images pixels by less than 20% will be removed from the list
 * @return filtered array of dimensions
 */
function filterSizes(list: number[], factor?: number): number[]
function filterSizes(list: Dimension[], factor?: number): Dimension[]
function filterSizes(
  list: number[] | Dimension[],
  factor: number = 0.8
): number[] | Dimension[] {
  // sort list from large to small
  let sorted = isDimensionArray(list)
    ? [...list].sort((a, b) => b.w * b.h - a.w * a.h)
    : [...list].sort((a, b) => b - a)
  let filtered: any[] = []
  for (let i = 0, j = 1; i < sorted.length; ) {
    let a = sorted[i],
      b = sorted[j]
    if (a && !b) {
      filtered.push(a)
      break
    }
    let scale1 = (isDimension(b) ? b.w : b) / (isDimension(a) ? a.w : a)
    let scale2 = (isDimension(b) ? b.h : b) / (isDimension(a) ? a.h : a)
    if (scale1 * scale2 < factor) {
      filtered.push(a)
      i = j
      j = i + 1
    } else {
      j++
    }
  }
  return filtered
}

/**
 * Parses the value of the img element's sizes attribute.
 *
 * @param sizesQueryString - a string representation of a valid img 'sizes' attribute
 * @return an array of SizesQuery.Object objects describing media query parameters
 */
function parseSizes(sizesQueryString: SizesQuery.String): SizesQuery.Object[] {
  return sizesQueryString.split(/\s*,\s*/).map((descriptor: string) => {
    let conditions: SizesQuery.Condition[] = []
    let parsed = descriptor.match(/^(.*)\s+(\S+)$/) // TODO get this from parser instead; last node in media-query
    if (!parsed) return { conditions, width: descriptor }

    let [, mediaCondition, width]: string[] = parsed
    if (mediaCondition) {
      // TODO handle expressions wrapped in extra parenthesis
      let mediaQuery = mediaParser(mediaCondition).nodes[0]
      for (let node of mediaQuery.nodes) {
        if (node.type === 'media-feature-expression') {
          conditions.push({
            mediaFeature: node.nodes.find(n => n.type === 'media-feature')!
              .value,
            value: node.nodes.find(n => n.type === 'value')!.value, // TODO if value is null, should treat valid mediaFeatures as booleans
          })
        } else if (node.type === 'keyword') {
        // } else if (node.type === 'keyword' && node.value === 'and') {
          // continue // TODO wouldn't be valid sizes attribute, but regardless this doesn't work
          // // maybe parse with cssValue here?

          if (node.value === 'and' || node.value === 'only') {
            continue // ignore; add next valid node to the conditions list
          } else if (node.value === 'not') {
            // TODO handle not
            console.warn(`not keyword is not yet handled; ignoring`)
            continue
          } else {
            throw new Error(`invalid media query keyword: ${node.value}`)
          }
        } else if (node.type === 'media-type') {
          if (node.value === 'all')
            continue // ignore; all is the only valid media-type
          else
            throw new Error(`media type ${node.value} cannot be used in a sizes attribute`)
        } else {
          console.error(node)
          throw new Error('unhandled node type')
        }
      }
    }
    return { conditions, width }
  })
}

export {
  widthsFromSizes,
  queriesFromSizes,
  parseSizes,
  deviceImages,
  filterSizes,
}
