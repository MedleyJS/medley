'use strict'

const t = require('tap')
const medley = require('../..')
const app = medley()

let errored = false

app.route({
  method: 'GET',
  path: '/',
  handler() {
    throw new Error('kaboom')
  },
})

process.on('uncaughtException', (err) => {
  errored = true
  t.equal(err.message, 'kaboom')
})

app.inject('/', () => {
  t.fail('should not be called')
})

process.on('beforeExit', () => {
  t.ok(errored)
})
