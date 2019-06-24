'use strict'

const {test} = require('tap')
const http = require('http')
const request = require('./utils/request')
const stream = require('stream')
const medley = require('..')

test('adding a hook should throw if given invalid parameters', (t) => {
  t.plan(3)

  const app = medley()
  const noop = () => null

  t.throws(
    () => app.addHook(null, noop),
    new TypeError('The hook name must be a string')
  )

  t.throws(
    () => app.addHook('notHook', noop),
    new Error("'notHook' is not a valid hook name. Valid hooks are: 'onRequest', 'onSend', 'onFinished'")
  )

  t.throws(
    () => app.addHook('onRequest', null),
    new TypeError('The hook callback must be a function')
  )
})

test('hooks', (t) => {
  t.plan(14)

  const payload = {hello: 'world'}
  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    req.onRequestVal = 'the request is coming'
    res.onRequestVal = 'the response has come'
    if (req.method === 'DELETE') {
      next(new Error('some error'))
    } else {
      next()
    }
  })

  app.addHook('onSend', function(req, res, _payload, next) {
    t.ok('onSend called')
    next()
  })

  app.addHook('onFinished', function(req, res) {
    t.equal(req.onRequestVal, 'the request is coming')
    t.equal(res.stream.finished, true)
  })

  app.get('/', function(req, res) {
    t.is(req.onRequestVal, 'the request is coming')
    t.is(res.onRequestVal, 'the response has come')
    res.send(payload)
  })

  app.delete('/', function(req, res) {
    res.send(payload)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/', {method: 'DELETE'}, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('hooks can return a promise to continue', (t) => {
  t.plan(4)

  const app = medley()

  app.addHook('onRequest', () => {
    t.pass('onRequest hook called')
    return Promise.resolve()
  })

  app.addHook('onSend', () => {
    t.pass('onSend hook called')
    return Promise.resolve()
  })

  // onFinished hooks are synchronous so this doesn't apply to them

  app.get('/', (req, res) => {
    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })
})

test('onRequest hook should support encapsulation', (t) => {
  t.plan(6)
  const app = medley()

  app.createSubApp()
    .addHook('onRequest', (req, res, next) => {
      t.equal(req.url, '/plugin')
      t.equal(res.sent, false)
      next()
    })
    .get('/plugin', (req, res) => {
      res.send()
    })

  app.get('/root', (req, res) => {
    res.send()
  })

  request(app, '/root', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })

  request(app, '/plugin', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })
})

test('onRequest hooks in sub-app should run after parent’s hooks', (t) => {
  t.plan(12)
  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    req.first = true
    next()
  })

  app.get('/first', (req, res) => {
    t.equal(req.first, true)
    t.equal(req.second, undefined)
    res.send({hello: 'world'})
  })

  app.createSubApp()
    .addHook('onRequest', (req, res, next) => {
      req.second = true
      next()
    })
    .get('/second', (req, res) => {
      t.equal(req.first, true)
      t.equal(req.second, true)
      res.send({hello: 'world'})
    })

  request(app, '/first', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/second', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('onFinished hook should support encapsulation', (t) => {
  t.plan(5)
  const app = medley()

  app.createSubApp()
    .addHook('onFinished', (req, res) => {
      t.strictEqual(res.plugin, true)
    })
    .get('/plugin', (req, res) => {
      res.plugin = true
      res.send()
    })

  app.get('/root', (req, res) => {
    res.send()
  })

  request(app, '/root', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })

  request(app, '/plugin', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })
})

test('onFinished hooks in sub-app should run after parent’s hooks', (t) => {
  t.plan(14)
  const app = medley()

  app.addHook('onFinished', (req, res) => {
    t.ok(req)
    t.ok(res)
  })

  app.get('/first', (req, res) => {
    res.send({hello: 'world'})
  })

  app.createSubApp()
    .addHook('onFinished', (req, res) => {
      t.ok(req)
      t.ok(res)
    })
    .get('/second', (req, res) => {
      res.send({hello: 'world'})
    })

  request(app, '/first', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/second', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('onFinished hook should run if the client closes the connection', (t) => {
  t.plan(6)

  const app = medley()

  app.addHook('onFinished', (req, res) => {
    t.equal(req.method, 'GET')
    t.equal(res.stream.finished, false)
  })

  var clientRequest

  app.get('/', () => {
    clientRequest.abort()
    t.pass('aborted request')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    clientRequest = http.get(`http://localhost:${app.server.address().port}`)

    clientRequest.on('error', (err) => {
      t.type(err, Error)
      t.equal(err.code, 'ECONNRESET')
    })
  })
})

test('onSend hook should support encapsulation', (t) => {
  t.plan(5)
  const app = medley()

  app.createSubApp()
    .addHook('onSend', (req, res, payload, next) => {
      t.equal(req.url, '/plugin')
      next()
    })
    .get('/plugin', (req, res) => {
      res.send()
    })

  app.get('/root', (req, res) => {
    res.send()
  })

  request(app, '/root', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })

  request(app, '/plugin', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })
})

test('onSend hooks in sub-app should run after parent’s hooks', (t) => {
  t.plan(11)
  const app = medley()

  app.addHook('onSend', (req, res, payload, next) => {
    t.pass('first onSend hook called')
    req.first = true
    next()
  })

  app.get('/first', (req, res) => {
    res.send({hello: 'world'})
  })

  app.createSubApp()
    .addHook('onSend', (req, res, payload, next) => {
      t.equal(req.first, true)
      req.second = true
      next()
    })
    .get('/second', (req, res) => {
      res.send({hello: 'world'})
    })

  app.createSubApp()
    .addHook('onSend', () => {
      t.fail('this should never be called')
    })

  request(app, '/first', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/second', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('onSend hook is called after payload is serialized and headers are set', (t) => {
  t.plan(24)
  const app = medley()

  {
    const payload = {hello: 'world'}

    app.createSubApp()
      .addHook('onSend', (req, res, serializedPayload, next) => {
        t.strictDeepEqual(JSON.parse(serializedPayload), payload)
        t.equal(res.get('content-type'), 'application/json')
        next()
      })
      .get('/json', (req, res) => {
        res.send(payload)
      })
  }

  app.createSubApp()
    .addHook('onSend', (req, res, serializedPayload, next) => {
      t.strictEqual(serializedPayload, 'some text')
      t.strictEqual(res.get('content-type'), 'text/plain; charset=utf-8')
      next()
    })
    .get('/text', (req, res) => {
      res.send('some text')
    })

  {
    const payload = Buffer.from('buffer payload')

    app.createSubApp()
      .addHook('onSend', (req, res, serializedPayload, next) => {
        t.strictEqual(serializedPayload, payload)
        t.strictEqual(res.get('content-type'), 'application/octet-stream')
        next()
      })
      .get('/buffer', (req, res) => {
        res.send(payload)
      })
  }

  {
    let chunk = 'stream payload'
    const payload = new stream.Readable({
      read() {
        this.push(chunk)
        chunk = null
      },
    })

    app.createSubApp()
      .addHook('onSend', (req, res, serializedPayload, next) => {
        t.strictEqual(serializedPayload, payload)
        t.strictEqual(res.get('content-type'), 'application/octet-stream')
        next()
      })
      .get('/stream', (req, res) => {
        res.send(payload)
      })
  }

  request(app, {
    method: 'GET',
    url: '/json',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
    t.strictEqual(res.headers['content-length'], '17')
  })

  request(app, {
    method: 'GET',
    url: '/text',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'some text')
    t.strictEqual(res.headers['content-length'], '9')
  })

  request(app, {
    method: 'GET',
    url: '/buffer',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'buffer payload')
    t.strictEqual(res.headers['content-length'], '14')
  })

  request(app, {
    method: 'GET',
    url: '/stream',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'stream payload')
    t.strictEqual(res.headers['transfer-encoding'], 'chunked')
  })
})

test('onSend hooks can modify payload', (t) => {
  t.plan(10)
  const app = medley()
  const payload = {hello: 'world'}
  const modifiedPayload = {hello: 'modified'}
  const anotherPayload = '"winter is coming"'

  app.addHook('onSend', (req, res, serializedPayload, next) => {
    t.ok('onSend called')
    t.strictDeepEqual(JSON.parse(serializedPayload), payload)
    next(null, serializedPayload.replace('world', 'modified'))
  })

  app.addHook('onSend', (req, res, serializedPayload, next) => {
    t.ok('onSend called')
    t.strictDeepEqual(JSON.parse(serializedPayload), modifiedPayload)
    next(null, anotherPayload)
  })

  app.addHook('onSend', (req, res, serializedPayload, next) => {
    t.ok('onSend called')
    t.strictEqual(serializedPayload, anotherPayload)
    next()
  })

  app.get('/', (req, res) => {
    res.send(payload)
  })

  request(app, {
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.body, anotherPayload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '18')
  })
})

test('onSend hooks can clear payload', (t) => {
  t.plan(6)
  const app = medley()

  app.addHook('onSend', (req, res, payload, next) => {
    t.ok('onSend called')
    res.status(304)
    next(null, null)
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  request(app, {
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 304)
    t.strictEqual(res.body, '')
    t.strictEqual(res.headers['content-length'], undefined)
    t.strictEqual(res.headers['content-type'], 'application/json')
  })
})

test('onSend hook throws', (t) => {
  t.plan(6)
  const app = medley()
  app.addHook('onSend', (req, res, payload, next) => {
    if (req.method === 'DELETE') {
      next(new Error('some error'))
      return
    }
    next()
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.delete('/', (req, res) => {
    res.send({hello: 'world'})
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/', {method: 'DELETE'}, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('cannot add hook after listening', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    app.server.unref()
    t.error(err)
    t.throws(
      () => app.addHook('onRequest', _ => _),
      new Error('Cannot call "addHook()" when app is already loaded')
    )
  })
})

test('onRequest hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('onRequest', (req, res) => {
    res.send('hello')
  })

  app.addHook('onRequest', () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(payload, 'hello')
    next()
  })

  app.addHook('onFinished', () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  request(app, {
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.body, 'hello')
  })
})

test('async onRequest hooks should be able to send a response', (t) => {
  t.plan(3)
  const app = medley()

  app.addHook('onRequest', (req, res) => {
    res.send('hello')
    return Promise.resolve(false)
  })

  app.get('/', () => {
    t.fail('this should not be called')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'hello')
  })
})

test('onRequest hooks can be added after the route is defined', (t) => {
  t.plan(13)
  const app = medley()

  app.createSubApp()
    .addHook('onRequest', (req, res, next) => {
      t.strictEqual(req.previous, undefined)
      req.previous = 1
      next()
    })
    .get('/encapsulated', (req, res) => {
      t.strictEqual(req.previous, 2)
      res.send('hello world')
    })
    .addHook('onRequest', (req, res, next) => {
      t.strictEqual(req.previous, 1)
      req.previous = 2
      next()
    })

  app.get('/', (req, res) => {
    t.strictEqual(req.previous, 3)
    res.send('hello world')
  })

  app.addHook('onRequest', (req, res, next) => {
    t.strictEqual(req.previous, undefined)
    req.previous = 1
    next()
  })

  app.addHook('onRequest', (req, res, next) => {
    t.strictEqual(req.previous, 1)
    req.previous = 2
    next()
  })

  app.addHook('onRequest', (req, res, next) => {
    t.strictEqual(req.previous, 2)
    req.previous = 3
    next()
  })

  request(app, '/encapsulated', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'hello world')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'hello world')
  })
})

test('onSend hooks can be added after the route is defined', (t) => {
  t.plan(11)
  const app = medley()

  app.createSubApp()
    .addHook('onSend', function(req, res, payload, next) {
      t.strictEqual(req.previous, undefined)
      req.previous = 1
      next()
    })
    .get('/encapsulated', function(req, res) {
      res.send({})
    })
    .addHook('onSend', function(req, res, payload, next) {
      t.strictEqual(req.previous, 1)
      next(null, '2')
    })

  app.get('/', function(req, res) {
    res.send({})
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.strictEqual(req.previous, undefined)
    req.previous = 1
    next()
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.strictEqual(req.previous, 1)
    req.previous = 2
    next()
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.strictEqual(req.previous, 2)
    next(null, '3')
  })

  request(app, '/encapsulated', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, '2')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, '3')
  })
})

test('onFinished hooks can be added after the route is defined', (t) => {
  t.plan(11)
  const app = medley()

  app.createSubApp()
    .addHook('onFinished', (req, res) => {
      t.strictEqual(res.previous, undefined)
      res.previous = 1
    })
    .get('/encapsulated', function(req, res) {
      res.send('hello world')
    })
    .addHook('onFinished', (req, res) => {
      t.strictEqual(res.previous, 1)
    })

  app.get('/', (req, res) => {
    res.send('hello world')
  })

  app.addHook('onFinished', (req, res) => {
    t.strictEqual(res.previous, undefined)
    res.previous = 1
  })

  app.addHook('onFinished', (req, res) => {
    t.strictEqual(res.previous, 1)
    res.previous = 2
  })

  app.addHook('onFinished', (req, res) => {
    t.strictEqual(res.previous, 2)
  })

  request(app, '/encapsulated', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'hello world')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'hello world')
  })
})

test('async onRequest hooks should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.addHook('onRequest', () => {
    return Promise.reject(new Error('onRequest error'))
  })

  app.addHook('onRequest', () => {
    t.fail('this should not be called')
  })

  app.get('/', () => {
    t.fail('this should not be called')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.body).message, 'onRequest error')
  })
})
