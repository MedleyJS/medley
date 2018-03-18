'use strict'

const t = require('tap')
const medley = require('..')

t.test('501', (t) => {
  t.plan(5)

  const app = medley()

  app.all('/', (request, response) => {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'TRACE',
    url: '/',
  }, (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 501)
    t.equal(response.payload, 'Unsupported request method: TRACE')
    t.equal(response.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(response.headers['content-length'], '33')
  })
})
