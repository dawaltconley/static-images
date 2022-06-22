declare namespace MediaQuery {
  interface Node {
    type:
      | 'media-query-list' // i.e. '(max-width: 100px), not print'
      | 'media-query' // i.e. '(max-width: 100px)', 'not print'
      | 'media-feature-expression' // i.e. '(max-width: 100px)'
      | 'media-feature' // i.e. 'max-height'
      | 'colon' // i.e. ':'
      | 'value' // i.e. '100px'
      | 'media-type' // i.e. 'print'
      | 'keyword' // i.e. 'not'
      | undefined // invalid
    before: string
    after: string
    value: string
    sourceIndex: number
    parent?: Node
    nodes?: Node[]
  }

  // where does this go?
  interface Undefined extends Node {
    type: undefined
  }

  interface List extends Node {
    type: 'media-query-list'
    nodes: Query[]
    parent: never
  }

  interface Query extends Node {
    type: 'media-query'
    nodes: (FeatureExpression | Keyword | Type)[]
    parent: List
  }

  interface FeatureExpression extends Node {
    type: 'media-feature-expression'
    nodes: [Feature, Colon, Value] | [Node] // singular if feature expression is just a set of parenthesis
    parent: Query
  }

  interface Feature extends Node {
    type: 'media-feature'
    nodes: never
    parent: FeatureExpression
  }

  interface Colon extends Node {
    type: 'colon'
    nodes: never
    parent: FeatureExpression
    value: ':'
  }

  interface Value extends Node {
    type: 'value'
    nodes: never
    parent: FeatureExpression
  }

  interface Type extends Node {
    type: 'media-type'
    nodes: never
    parent: Query
    // value: 'all' | 'print' | 'screen' | 'tty' | 'tv' | 'projection' | 'handheld' | 'braille' | 'embossed' | 'aural' | 'speech'
  }

  interface Keyword extends Node {
    type: 'keyword'
    nodes: never
    parent: Query
    // value: 'and' | 'only' | 'not'
  }
}

declare module 'postcss-media-query-parser' {
  export default function parseMedia(queryString: string): MediaQuery.List
}
