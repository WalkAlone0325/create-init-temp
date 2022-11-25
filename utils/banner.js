// require('gradient-string')([
//   { color: '#42d392', pos: 0 },
//   { color: '#42d392', pos: 0.1 },
//   { color: '#647eff', pos: 1 }
// ])('Vue.js - The Progressive JavaScript Framework'))
//
import gradient from 'gradient-string'
import tinycolor from 'tinycolor2'

let coolGradient = gradient([
  tinycolor('#FFBB65'), // tinycolor object
  { r: 0, g: 255, b: 0 }, // RGB object
  { h: 240, s: 1, v: 1, a: 1 }, // HSVa object
  'rgb(120, 120, 0)', // RGB CSS string
  'gold' // named color
])

const title = coolGradient('Create Project Template')

export { title }
