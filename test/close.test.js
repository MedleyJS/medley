'use strict'

const {test} = require('tap')
const medley = require('..')

test('.close() stops the server and runs onClose handlers in the context of the app', (t) => {
  t.plan(4)

  const app = medley()
  app.onClose(onClose)

  function onClose(done) {
    t.equal(this, app)
    done()
  }

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.equal(app.server.listening, false, 'stops the http server')
    })
  })
})

test('inside a sub-app', (t) => {
  t.plan(3)

  const app = medley()
  const subApp = app.createSubApp()

  subApp.onClose(function(done) {
    t.equal(this, subApp)
    done()
  })

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
    })
  })
})

test('close order', (t) => {
  t.plan(5)

  const app = medley()
  let order = 1

  app.createSubApp()
    .onClose((done) => {
      t.equal(order++, 1)
      setImmediate(done)
    })

  app.onClose((done) => {
    t.equal(order++, 2)
    done()
  })

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.equal(order++, 3)
    })
  })
})

test('should not throw an error if the server is not listening', (t) => {
  t.plan(2)

  const app = medley()

  app.onClose(function(done) {
    t.equal(this, app)
    done()
  })

  app.close((err) => {
    t.error(err)
  })
})

test('should work with async functions', (t) => {
  t.plan(2)

  const app = medley()

  app.onClose(function() {
    t.equal(this, app)
    return Promise.resolve()
  })

  app.close((err) => {
    t.error(err)
  })
})

test('should pass a single error to the close callback and still run other onClose handlers', (t) => {
  t.plan(3)

  const app = medley()
  const error = new Error('onClose error')

  app.onClose((done) => {
    t.pass('first called')
    done(error)
  })

  app.onClose((done) => {
    t.pass('second called')
    done()
  })

  app.close((err) => {
    t.equal(err, error)
  })
})

test('should pass a single error to the close callback and still run other onClose handlers (Promises)', (t) => {
  t.plan(3)

  const app = medley()
  const error = new Error('onClose error')

  app.onClose(() => {
    t.pass('first called')
    return Promise.reject(error)
  })

  app.onClose((done) => {
    t.pass('second called')
    done()
  })

  app.close((err) => {
    t.equal(err, error)
  })
})

test('should pass an array of errors to the close callback and still run other onClose handlers', (t) => {
  t.plan(5)

  const app = medley()
  const error = new Error('onClose error')

  app
    .onClose((done) => {
      t.pass('first called')
      done(error)
    })
    .onClose((done) => {
      t.pass('second called')
      process.nextTick(done)
    })
    .onClose((done) => {
      t.pass('third called')
      done(error)
    })
    .onClose((done) => {
      t.pass('fourth called')
      done()
    })

  app.close((err) => {
    t.strictDeepEqual(err, [error, error])
  })
})
