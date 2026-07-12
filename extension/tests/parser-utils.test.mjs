import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCompactNumber, parseNumericPrice } from '../content/parsers/parser-utils.js'

test('parseNumericPrice reads visible and range prices without inventing values', () => {
  assert.equal(parseNumericPrice('$19.99'), 19.99)
  assert.equal(parseNumericPrice('12.50 - 25.00'), 12.5)
  assert.equal(parseNumericPrice('price unavailable'), undefined)
})

test('parseCompactNumber supports marketplace sales suffixes', () => {
  assert.equal(parseCompactNumber('8.5K sold'), 8500)
  assert.equal(parseCompactNumber('1.2万 已售'), 12000)
  assert.equal(parseCompactNumber('2 rb terjual'), 2000)
  assert.equal(parseCompactNumber('unknown'), undefined)
})
