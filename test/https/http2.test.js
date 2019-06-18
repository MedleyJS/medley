'use strict'

const t = require('tap')
const fs = require('fs')
const path = require('path')
const medley = require('../..')
const h2url = require('h2url')
const request = require('../utils/request')

const msg = {hello: 'world'}

t.test('unencrypted - true', (t) => {
  t.plan(4)

  var app = medley({
    http2: true,
  })

  app.get('/', function(req, res) {
    res.send(msg)
  })

  app.listen(0, async (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)

    t.strictDeepEqual(JSON.parse(res.body), msg)
  })
})

t.test('unencrypted - object', (t) => {
  t.plan(4)

  var app = medley({
    http2: {peerMaxConcurrentStreams: 20},
  })

  app.get('/', function(req, res) {
    res.send(msg)
  })

  app.listen(0, async (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)

    t.strictDeepEqual(JSON.parse(res.body), msg)
  })
})

t.test('secure', (t) => {
  t.plan(4)

  var app = medley({
    http2: {
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.crt')),
    },
  })

  app.get('/', function(req, response) {
    response.send(msg)
  })

  app.listen(0, async (err) => {
    t.error(err)
    app.server.unref()

    const url = `https://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)
    t.strictDeepEqual(JSON.parse(res.body), msg)
  })
})

t.test('secure with fallback', (t) => {
  t.plan(5)

  var app = medley({
    http2: {
      allowHTTP1: true,
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.crt')),
    },
  })

  app.get('/', function(req, response) {
    response.send(msg)
  })

  app.get('/error', async function() {
    await Promise.resolve()
    throw new Error('kaboom')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    t.test('http2 get error', async (t) => {
      t.plan(1)

      const url = `https://localhost:${app.server.address().port}/error`
      const res = await h2url.concat({url})

      t.strictEqual(res.headers[':status'], 500)
    })

    t.test('http2 get request', async (t) => {
      t.plan(3)

      const url = `https://localhost:${app.server.address().port}`
      const res = await h2url.concat({url})

      t.strictEqual(res.headers[':status'], 200)
      t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)
      t.strictDeepEqual(JSON.parse(res.body), msg)
    })

    t.test('http1 get request', (t) => {
      t.plan(4)

      request(app, '/', {rejectUnauthorized: false}, (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.strictEqual(res.headers['content-length'], '' + res.body.length)
        t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
      })
    })

    t.test('http1 get error', (t) => {
      t.plan(2)

      request(app, '/error', {rejectUnauthorized: false}, (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 500)
      })
    })
  })
})
