'use strict'

if (require('./testUtils.js').supportsAsyncAwait) {
  require('./body-parser.async')
}

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')
const jsonParser = require('fast-json-body')

test('addBodyParser should add a custom parser', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.options('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)

    t.tearDown(() => app.close())

    t.test('in POST', (t) => {
      t.plan(3)

      sget({
        method: 'POST',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })

    t.test('in OPTIONS', (t) => {
      t.plan(3)

      sget({
        method: 'OPTIONS',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })
  })
})

test('bodyParser should handle multiple custom parsers', (t) => {
  t.plan(7)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.post('/hello', (req, response) => {
    response.send(req.body)
  })

  function customParser(req, done) {
    jsonParser(req.stream, done)
  }

  app.addBodyParser('application/jsoff', customParser)
  app.addBodyParser('application/json', customParser)

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port + '/hello',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
    })
  })
})

test('bodyParser should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', function(req, done) {
    done(new Error('kaboom!'), {})
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
      app.close()
    })
  })
})

test('bodyParser should support encapsulation', (t) => {
  t.plan(7)
  const app = medley()

  app.addBodyParser('application/json', function(req, done) {
    jsonParser(req.stream, done)
  })

  app.use((subApp) => {
    subApp.post('/', (req, response) => {
      response.send(req.body)
    })

    subApp.addBodyParser('application/jsoff', function(req, done) {
      jsonParser(req.stream, done)
    })
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), '{"hello":"world"}')
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), '{"hello":"world"}')
    })
  })
})

test('bodyParser should not by default support requests with an unknown Content-Type', (t) => {
  t.plan(5)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'unknown content type!',
      headers: {
        'Content-Type': 'unknown',
      },
    }, (err, response) => {
      t.error(err)
      t.equal(response.statusCode, 415)
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'undefined content type!',
      headers: {
        // 'Content-Type': undefined
      },
    }, (err, response) => {
      t.error(err)
      t.equal(response.statusCode, 415)
    })
  })
})

test('contentType must be MIME pattern string, an array of such strings, or a function', (t) => {
  t.plan(5)

  const app = medley()
  const func = () => {}

  t.throws(() => app.addBodyParser(null, func), TypeError)
  t.throws(() => app.addBodyParser('', func), Error)
  t.throws(() => app.addBodyParser(['text/plain', 'bogus'], func), Error)

  t.doesNotThrow(() => app.addBodyParser(func, func))
  t.doesNotThrow(() => app.addBodyParser(['text/plain', 'image/*'], func))
})

test('bodyParser should run only if it exactly matches the given content-type', (t) => {
  t.plan(7)

  const app = medley()

  t.tearDown(() => app.close())

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    t.fail('application/json should never be matched')
    jsonParser(req.stream, done)
  })

  app.addBodyParser('*/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'Content-Type': 'application/jsons',
      },
      body: '{"hello":"world"}',
    }, (err, response) => {
      t.error(err)
      t.equal(response.statusCode, 415)
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'Content-Type': 'text/json',
      },
      body: '{"hello":"world"}',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(response.headers['content-type'], 'application/json')
      t.equal(body.toString(), '{"hello":"world"}')
    })
  })
})

test('parsers are matched in the order in which they are added', (t) => {
  t.plan(8)

  const app = medley()

  t.tearDown(() => app.close())

  var order = 0

  app.addBodyParser(() => {
    t.equal(order++, 0)
    return false
  }, () => t.fail('unmatched body parser should not be called'))

  app.addBodyParser(() => {
    t.equal(order++, 1)
    return false
  }, () => t.fail('unmatched body parser should not be called'))

  app.addBodyParser('application/*', function(req, done) {
    t.equal(order++, 2)
    done(null, 'first')
  })

  app.addBodyParser('application/json', function() {
    t.fail('the second body parser should never be called')
  })

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: `http://localhost:${app.server.address().port}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'true',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.match(response.headers['content-type'], 'text/plain')
      t.equal(body.toString(), 'first')
    })
  })
})

test('the parser must be a function', (t) => {
  t.plan(1)

  const app = medley()

  t.throws(
    () => app.addBodyParser('aaa', null),
    new TypeError('The parser argument must be a function. Got: null')
  )
})

test('"catch all" body parser', (t) => {
  t.plan(7)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser(() => true, function(req, done) {
    var data = ''
    req.stream.on('data', (chunk) => {
      data += chunk
    })
    req.stream.on('end', () => {
      done(null, data)
    })
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': 'very-weird-content-type',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), 'hello')
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': '', // Empty string
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), 'hello')
    })
  })
})

test('cannot add body parser after binding', (t) => {
  t.plan(2)

  const app = medley()

  t.tearDown(app.close.bind(app))

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(0, function(err) {
    t.error(err)

    try {
      app.addBodyParser('*', () => {})
      t.fail()
    } catch (e) {
      t.pass()
    }
  })
})

test('The charset should not interfere with the content type handling', (t) => {
  t.plan(5)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', function(req, done) {
    t.ok('called')
    jsonParser(req.stream, function(err, body) {
      done(err, body)
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '{"hello":"world"}')
      app.close()
    })
  })
})

test('body parsers added after a sub-app has been created should be inherited by the sub-app', (t) => {
  t.plan(10)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.use((subApp) => {
    subApp.post('/sub-app', (req, res) => {
      res.send(req.body)
    })
  })

  app.addBodyParser('application/json', (req, done) => {
    t.ok('called')
    jsonParser(req.stream, done)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"hello":"world"}')
  })

  app.inject({
    method: 'POST',
    url: '/sub-app',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"hello":"world"}')
  })
})
