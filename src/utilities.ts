const devices: Device[] = require('./default-devices.json')

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

/** represents a media query condition, such as `(min-width: 600px)` */
interface MediaCondition {
  /** type of media query; usually 'min-width' or 'max-width' */
  mediaFeature: string
  /** breakpoint where this applies */
  value: string
}

/**
 * represents a valid rule for the img sizes attribute,
 * such as `(min-width: 600px) 400px` or `100vw`
 */
interface Size {
  /** the conditions under which a sizes rule applies */
  conditions: MediaCondition[]
  /** the image width applied under these conditions */
  width: string
}

interface Dimension {
  /** width */
  w: number
  /** height */
  h: number
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

/** represents a supported device */
interface Device extends Dimension {
  /** possible dppx for devices with these dimensions */
  dppx: number[]
  /** whether the device can be rotated and the dimensions flipped */
  flip: boolean
}

type Order = 'min' | 'max'

/**
 * Takes a parsed img sizes attribute and a specific device,
 * returning the image widths needed to support that device.
 *
 * @param sizes
 * @param device - object representing an expected device
 * @param order - whether the widths should be interpreted as 'min' or 'max'
 * @return unique widths that will need to be produced for the given device
 */
function deviceWidths(
  sizes: Size[],
  device: Device /* , order: Order */
): Set<number> {
  let imgWidth: string

  whichSize: for (let { conditions, width } of sizes) {
    imgWidth = width
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
    break whichSize
  }

  let needWidths: Set<number> = new Set()

  device.dppx.forEach((dppx: number) => {
    let [scaledWidth, unit = 'px']: [number, string] = cssValue(imgWidth)
    if (unit === 'vw') scaledWidth = (device.w * scaledWidth) / 100
    scaledWidth = Math.ceil(scaledWidth * dppx)
    needWidths.add(scaledWidth)
  })

  console.log(device, needWidths)

  return needWidths
}

/**
 * @param sizesQueryString - a string representation of a valid img 'sizes' attribute
 * @returns an array of dimensions, which represent image copies that should be produced to satisfy these sizes.
 */

function widthsFromSizes(
  sizesQueryString: string,
  opt: {
    order?: Order
    minScale?: number
  } = {}
): number[] {
  let { order, minScale } = opt
  let sizes = parseSizes(sizesQueryString)

  let needWidths: Set<number> = devices.reduce((all, device) => {
    deviceWidths(sizes, device).forEach(n => all.add(n), all)
    return all
  }, new Set<number>())

  let widthsArray: number[] = Array.from(needWidths)

  return filterSizes(widthsArray, minScale)
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

interface MediaQueryNode {
  type:
    | 'media-query-list' // i.e. '(max-width: 100px), not print'
    | 'media-query' // i.e. '(max-width: 100px)', 'not print'
    | 'media-feature-expression' // i.e. '(max-width: 100px)'
    | 'media-feature' // i.e. 'max-height'
    | 'colon' // i.e. ':'
    | 'value' // i.e. '100px'
    | 'media-type' // i.e. 'print'
    | 'keyword' // i.e. 'not'
  after: string
  before: string
  value: string
  sourceIndex: number
  parent?: MediaQueryNode
  nodes: MediaQueryNode[]
}

// valid units for queries are:
// width/height: px, em, rem

/**
 * Parses the value of the img element's sizes attribute.
 *
 * @param sizesQueryString - a string representation of a valid img 'sizes' attribute
 * @return an array of Size objects describing media query parameters
 */
function parseSizes(sizesQueryString: string): Size[] {
  const mediaParser = require('postcss-media-query-parser').default
  return sizesQueryString.split(/\s*,\s*/).map((descriptor: string) => {
    let conditions: MediaCondition[] = []
    let parsed = descriptor.match(/^(.*)\s+(\S+)$/)
    if (!parsed) return { conditions, width: descriptor }

    let [, mediaCondition, width]: string[] = parsed
    if (mediaCondition) {
      if (
        /^\(.*\)$/.test(mediaCondition) &&
        mediaCondition.indexOf('(', 1) > mediaCondition.indexOf(')')
      ) {
        // not clear what this condition is supposed to do
        // seems like it wants to remove enclosing parenthesis
        // but it never seems to fire
        // probably wants to fire on ((min-width: 49em) and (max-width: 55px))
        // but instead fires on (min-width: 49em) and (max-width: 55px)
        mediaCondition = mediaCondition.slice(1, -1)
      }
      let parsed = mediaParser(mediaCondition).nodes[0] as MediaQueryNode
      for (let node of parsed.nodes) {
        if (node.type === 'media-feature-expression') {
          conditions.push({
            mediaFeature: node.nodes.find(n => n.type === 'media-feature')!
              .value,
            value: node.nodes.find(n => n.type === 'value')!.value,
          })
        } else if (node.type === 'keyword' && node.value === 'and') {
          continue // TODO wouldn't be valid sizes attribute, but regardless this doesn't work
          // maybe parse with cssValue here?
        } else {
          // not currently supporting other keywords, like not
          break
        }
      }
    }
    return { conditions, width }
  })
}

module.exports = {
  devices,
  widthsFromSizes,
  parseSizes,
  deviceWidths,
  filterSizes,
}
