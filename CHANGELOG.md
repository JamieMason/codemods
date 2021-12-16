## [0.16.3](https://github.com/JamieMason/codemods/compare/0.15.2...0.16.3) (2021-12-16)

### Bug Fixes

- **npm:** update jscodeshift
  ([51d238f](https://github.com/JamieMason/codemods/commit/51d238f0528997dcda1461a76da68079969306c8))

### Features

- **react:** convert string expression props to literals
  ([fe35134](https://github.com/JamieMason/codemods/commit/fe3513458c660e1e4bb8939b7d504c2b27d62de7))

## [0.15.2](https://github.com/JamieMason/codemods/compare/0.9.1...0.15.2) (2021-12-16)

### Bug Fixes

- **react:** handle when react is imported without default
  ([c94ab27](https://github.com/JamieMason/codemods/commit/c94ab27c09ab507093922891bcd0bdf8bf1b58ef))

### Features

- **parser:** switch from flow to tsx
  ([9f80087](https://github.com/JamieMason/codemods/commit/9f80087f5c7b56763edd1a01ca262aa6b0a734d3))
- **react:** remove propTypes set as properties
  ([78d53e9](https://github.com/JamieMason/codemods/commit/78d53e977d292588031553b323dc740491424a33)),
  closes [#12](https://github.com/JamieMason/codemods/issues/12)
- **react:** remove propTypes set via \_defineProperty
  ([6d3a514](https://github.com/JamieMason/codemods/commit/6d3a514386651e3db7200e2acf40bb2eb40fa7b2))
- **react:** remove use of react defaultProps
  ([e5afbb9](https://github.com/JamieMason/codemods/commit/e5afbb94cf4f5290574f59b297b1470046e9415a))
- **react:** remove use of react PropTypes
  ([970c459](https://github.com/JamieMason/codemods/commit/970c4598f7371efd620c025464841873b8d56822))
- **typescript:** process typescript files
  ([f5db971](https://github.com/JamieMason/codemods/commit/f5db9719111473789f75273b06dc1e1187b6b938))

## [0.9.1](https://github.com/JamieMason/codemods/compare/0.8.1...0.9.1) (2020-03-11)

### Features

- **react:** add missing react imports
  ([e5c35c7](https://github.com/JamieMason/codemods/commit/e5c35c7a18669a17cff022521ef9689169547b53))

## [0.8.1](https://github.com/JamieMason/codemods/compare/0.7.1...0.8.1) (2019-08-01)

### Features

- **react:** ignore spread elements when sorting props
  ([1ad03c9](https://github.com/JamieMason/codemods/commit/1ad03c92a2c6acde99728f5dd3d4f984b440766c))

## [0.7.1](https://github.com/JamieMason/codemods/compare/01a2944898cea2047996489643ae16a71e040d75...0.7.1) (2019-08-01)

### Bug Fixes

- **npm:** update dependencies
  ([c08b795](https://github.com/JamieMason/codemods/commit/c08b795c2a35c32511e1d3458f6057d0317c7520))

### Features

- **exports:** naively convert default to named
  ([b2e8318](https://github.com/JamieMason/codemods/commit/b2e8318fef078e2badf1ec3d3eab6c98311e0d43))
- **imports:** import packages from root indexes
  ([2e6279f](https://github.com/JamieMason/codemods/commit/2e6279f95188974c16e94a7fb9208cc536a52641))
- **imports:** naively convert default imports to named imports
  ([d61759c](https://github.com/JamieMason/codemods/commit/d61759c0b4bb8a03b40de6d8fa309dc4e8727415))
- **objects:** ignore spread elements when sorting members
  ([55f1599](https://github.com/JamieMason/codemods/commit/55f1599937a54d61d317ce9e89fbc19fbf667d1c)),
  closes [#2](https://github.com/JamieMason/codemods/issues/2)
- **objects:** sort members in a-z order
  ([e0abf87](https://github.com/JamieMason/codemods/commit/e0abf8755e17cb5fc42bcfee1571919c175209b5))
- **react:** sort JSX props in a-z order
  ([01a2944](https://github.com/JamieMason/codemods/commit/01a2944898cea2047996489643ae16a71e040d75))
- **scripts:** allow transforms to be run as npm scripts
  ([b1d6f1c](https://github.com/JamieMason/codemods/commit/b1d6f1c5eec26171a4c9aafc64c9aa331a6c0e69))
