'use strict'

const t = require('tap')
const medley = require('..')
const request = require('./utils/request')

t.test('queryParser', (t) => {
  t.plan(7)

  t.throws(
    () => medley({queryParser: true}),
    new TypeError("'queryParser' option must be a function. Got value of type 'boolean'")
  )

  t.throws(
    () => medley({queryParser: 'simple'}),
    new TypeError("'queryParser' option must be a function. Got value of type 'string'")
  )

  t.throws(
    () => medley({queryParser: []}),
    new TypeError("'queryParser' option must be a function. Got value of type 'object'")
  )

  const app = medley({
    queryParser: qs => 'querystring: ' + qs,
  })

  app.get('/', (req, res) => {
    res.send(req.query)
  })

  request(app, '/?a', (err, res) => {
    t.error(err)
    t.equal(res.body, 'querystring: a')
  })

  request(app, '/?b=2', (err, res) => {
    t.error(err)
    t.equal(res.body, 'querystring: b=2')
  })
})
