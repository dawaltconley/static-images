/**
 * represents a valid rule for the img sizes attribute,
 * such as `(min-width: 600px) 400px` or `100vw`
 */
declare namespace SizesQuery {
  type String = string
  type Order = 'min' | 'max'

  /** represents a media query condition, such as `(min-width: 600px)` */
  interface Condition {
    /** type of media query; usually 'min-width' or 'max-width' */
    mediaFeature: string

    /** breakpoint where this applies */
    value: string
  }

  interface Object {
    /** the conditions under which a sizes rule applies */
    conditions: Condition[]

    /** the image width applied under these conditions */
    width: string
  }
}

interface Dimension {
  /** width */
  w: number

  /** height */
  h: number
}

/** represents a supported device */
interface Device extends Dimension {
  /** possible dppx for devices with these dimensions */
  dppx: number[]

  /** whether the device can be rotated and the dimensions flipped */
  flip: boolean
}

declare namespace Query {
  type Orientation = 'landscape' | 'portrait'

  interface Image {
    /** width of an actual image */
    w: number

    /** device dppx at which this image size will apply */
    dppx: number

    /** device orientation in which this image will be used */
    orientation: Orientation

    /** if present treats this image as an alias for another image */
    use?: Omit<Image, 'use'>
  }

  interface Object extends Dimension {
    images: Image[]
  }

  type Map = {
    [key in Orientation]: Object[]
  }
}

type ImageMap = Record<Query.Orientation, Dimension[]>

/** sent to sass mixin */
interface SassQuery {
  orientation: Query.Orientation | false
  maxWidth: number | boolean | undefined
  minWidth: number | boolean | undefined
  maxResolution: number | boolean | undefined
  minResolution: number | boolean | undefined
  url: string
  sourceType: string
  format: string
}
