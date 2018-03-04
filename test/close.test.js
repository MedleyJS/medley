'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('close callback', t => {
  t.plan(4)
  const app = medley()
  app.addHook('onClose', onClose)

  function onClose(instance, done) {
    t.type(app, instance)
    done()
  }

  app.listen(0, err => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.ok('close callback')
    })
  })
})

test('inside register', t => {
  t.plan(5)
  const app = medley()
  app.register(function(f, opts, next) {
    f.addHook('onClose', onClose)

    function onClose(instance, done) {
      t.ok(instance.prototype === app.prototype)
      t.strictEqual(instance, f)
      done()
    }

    next()
  })

  app.listen(0, err => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.ok('close callback')
    })
  })
})

test('close order', t => {
  t.plan(5)
  const app = medley()
  const order = [1, 2, 3]

  app.register(function(f, opts, next) {
    f.addHook('onClose', (instance, done) => {
      t.is(order.shift(), 1)
      done()
    })

    next()
  })

  app.addHook('onClose', (instance, done) => {
    t.is(order.shift(), 2)
    done()
  })

  app.listen(0, err => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.is(order.shift(), 3)
    })
  })
})

test('should not throw an error if the server is not listening', t => {
  t.plan(2)
  const app = medley()
  app.addHook('onClose', onClose)

  function onClose(instance, done) {
    t.type(app, instance)
    done()
  }

  app.close((err) => {
    t.error(err)
  })
})

test('onClose should keep the context', t => {
  t.plan(4)
  const app = medley()
  app.register(plugin)

  function plugin(instance, opts, next) {
    instance.decorate('test', true)
    instance.addHook('onClose', onClose)
    t.ok(instance.prototype === app.prototype)

    function onClose(i, done) {
      t.ok(i.test)
      t.strictEqual(i, instance)
      done()
    }

    next()
  }

  app.close((err) => {
    t.error(err)
  })
})
