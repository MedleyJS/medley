'use strict'

const t = require('tap')
const medley = require('..')
const request = require('./utils/request')

t.test('.createSubApp() throws if prefix is not a string', (t) => {
  const app = medley()

  t.throws(
    () => app.createSubApp(null),
    new TypeError("'prefix' must be a string. Got a value of type 'object': null")
  )
  t.throws(
    () => app.createSubApp(2),
    new TypeError("'prefix' must be a string. Got a value of type 'number': 2")
  )

  t.end()
})

t.test('.createSubApp() throws if prefix does not start with a "/"', (t) => {
  const app = medley()

  t.throws(
    () => app.createSubApp('v1'),
    new Error("'prefix' must start with a '/' character. Got: 'v1'")
  )

  t.end()
})

t.test('.createSubApp() creates a new app that inherits from the app that .createSubApp() was called on', (t) => {
  t.plan(2)

  const app = medley()
  const subApp = app.createSubApp()

  t.notEqual(subApp, app)
  t.ok(app.isPrototypeOf(subApp))
})

t.test('.createSubApp() creates different sub-apps that can both define routes', (t) => {
  t.plan(9)

  const app = medley()

  const subApp1 = app.createSubApp()
  t.notEqual(subApp1, app)
  subApp1.get('/first', (req, res) => {
    res.send('first')
  })

  const subApp2 = app.createSubApp()
  t.notEqual(subApp2, app)
  subApp2.get('/second', (req, res) => {
    res.send('second')
  })

  t.notEqual(subApp1, subApp2)

  request(app, '/first', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'first')
  })

  request(app, '/second', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'second')
  })
})

t.test('.createSubApp() nested calls with prefix (route does not use slash)', (t) => {
  t.plan(4)

  const app = medley()
  const subApp = app.createSubApp('/parent')

  subApp.createSubApp('/child1')
    .get('', (req, res) => {
      res.send('child 1')
    })

  subApp.createSubApp('/child2')
    .get('', (req, res) => {
      res.send('child 2')
    })

  request(app, '/parent/child1', (err, res) => {
    t.error(err)
    t.equal(res.body, 'child 1')
  })

  request(app, '/parent/child2', (err, res) => {
    t.error(err)
    t.equal(res.body, 'child 2')
  })
})

t.test('.createSubApp() nested calls with prefix (route uses slash)', (t) => {
  t.plan(4)

  const app = medley()
  const subApp = app.createSubApp('/parent')

  subApp.createSubApp('/child1')
    .get('/', (req, res) => {
      res.send('child 1')
    })

  subApp.createSubApp('/child2')
    .get('/', (req, res) => {
      res.send('child 2')
    })

  request(app, '/parent/child1/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'child 1')
  })

  request(app, '/parent/child2/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'child 2')
  })
})
