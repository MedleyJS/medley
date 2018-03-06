# Hooks

Hooks are registered with the `app.addHook` method and allow you to listen to specific events in the application or request/response lifecycle. You have to register a hook before the event is triggered otherwise the event is lost.

## Request/Response Hooks

By using the hooks you can interact directly inside the lifecycle of Medley. There are five different Hooks that you can use *(in order of execution)*:
- `'onRequest'`
- `'preHandler'`
- `'onSend'`
- `'onResponse'`

Example:
```js
app.addHook('onRequest', (req, res, next) => {
  // some code
  next()
})

app.addHook('preHandler', (request, reply, next) => {
  // some code
  next()
})

app.addHook('onSend', (request, reply, next) => {
  // some code
  next()
})

app.addHook('onResponse', (res) => {
  // some code
})
```
Or `async/await`
```js
app.addHook('onRequest', async (req, res) => {
  // some code
  await asyncMethod()
  // error occurred
  if (err) {
    throw new Error('some errors occurred.')
  }
})

app.addHook('preHandler', async (request, reply) => {
  // some code
  await asyncMethod()
  // error occurred
  if (err) {
    throw new Error('some errors occurred.')
  }
})

app.addHook('onSend', async (request, reply) => {
  // some code
  await asyncMethod()
  // error occurred
  if (err) {
    throw new Error('some errors occurred.')
  }
})

app.addHook('onResponse', async (res) => {
  try {
    await asyncMethod()
  } catch (err) {
    // Errors must be handled manually in onResponse hooks
  }
})
```

| Parameter   |  Description  |
|-------------|-------------|
| req |  Node.js [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) |
| res | Node.js [ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) |
| request | Medley [Request](Request.md) interface |
| reply | Medley [Reply](Reply.md) interface |
| next | Function to continue with the [lifecycle](Lifecycle.md) |

It is pretty easy to understand where each hook is executed by looking at the [lifecycle page](Lifecycle.md).<br>
Hooks are affected by Medley's encapsulation, and can thus be applied to selected routes. See the [Scopes](#scope) section for more information.

If you get an error during the execution of you hook, just pass it to `next()` and Medley will automatically close the request and send the appropriate error code to the user.

```js
app.addHook('onRequest', (req, res, next) => {
  next(new Error('some error'))
})
```

If you want to pass a custom error code to the user, just use `reply.code()`:
```js
app.addHook('preHandler', (request, reply, next) => {
  reply.code(500)
  next(new Error('some error'))
})
```

*The error will be handled by [`Reply`](Reply.md#errors).*

Note that in the `'preHandler'` and `'onSend'` hook the request and reply objects are different from `'onRequest'`, because the two arguments are [`request`](Request.md) and [`reply`](Reply.md) core Medley objects.

#### The `onSend` Hook

Inside the `onSend` hook, the serialized payload will be available as the `payload` property on the `reply` object.

```js
app.get('/', (request, reply) => {
  reply.send({ hello: 'world' })  
})
app.addHook('onSend', (request, reply, next) => {
  console.log(reply.payload) // '{"hello":"world"}'
  next()
})
```

It is possible to modify the payload before it is sent by changing the `reply.payload` property.

```js
app.addHook('onSend', (request, reply, next) => {
  reply.payload = reply.payload.replace('world', 'everyone!')
  next()
})
```

Note: The payload may only be changed to a `string`, a `Buffer`, a `stream`, `null`, or `undefined`.

### Respond to a request from a hook
It is possible to respond to a request within a hook and skip the route handler. An example could be an authentication hook. If you are using `onRequest` should use `res.end()` and `beforeHandler`/`preHandler` hook should use `reply.send`.

```js
app.addHook('onRequest', (req, res, next) => {
  res.end('early response')
})

// Works with async functions too
app.addHook('preHandler', async (request, reply) => {
  reply.send({ hello: 'world' })
})
```

If responding with a stream, it is best to avoid using an `async` function for the hook. If using an `async` function is necessary, make sure to follow the pattern found in [test/hooks-async.js](https://github.com/fastify/fastify/blob/94ea67ef2d8dce8a955d510cd9081aabd036fa85/test/hooks-async.js#L269-L275).

```js
const pump = require('pump')

app.addHook('onRequest', (req, res, next) => {
  if (req.skip) return next()
  const stream = fs.createReadStream('some-file', 'utf8')
  pump(stream, res, (err) => { /* Handle error */ })
})
```

## Application Hooks

You are able to hook into the application-lifecycle as well. It's important to note that these hooks aren't fully encapsulated. The `this` inside the hooks are encapsulated but the handlers can respond to an event outside the encapsulation boundaries.

- `'onClose'`
- `'onRoute'`

<a name="on-close"></a>
**'onClose'**<br>
Triggered when `app.close()` is invoked to stop the server. It is useful when [plugins](Plugins.md) need a "shutdown" event, such as a connection to a database.<br>
The first argument is the app instance, the second one the `done` callback.
```js
app.addHook('onClose', (app, done) => {
  // some code
  done()
})
```
<a name="on-route"></a>
**'onRoute'**<br>
Triggered when a new route is registered. Listeners are passed a `routeOptions` object as the sole parameter. The interface is synchronous, and, as such, the listeners do not get passed a callback.
```js
app.addHook('onRoute', (routeOptions) => {
  routeOptions.url
  routeOptions.beforeHandler
  routeOptions.customValuePassedToRoute // For example
})
```
<a name="scope"></a>
### Scope
Except for [Application Hooks](#application-hooks), all hooks are encapsulated. This means that you can decide where your hooks should run by using `register` as explained in the [plugins guide](Plugins-Guide.md). If you pass a function, that function is bound to the right Medley context and from there you have full access to the Medley API.

```js
app.addHook('onRequest', function (req, res, next) {
  const self = this // Medley context
  next()
})
```

<a name="before-handler"></a>
### beforeHandler
Despite the name, `beforeHandler` is not a standard hook like `preHandler`, but is a function that your register right in the route option that will be executed only in the specified route. Can be useful if you need to handle the authentication at route level instead of at hook level (`preHandler` for example.), it could also be an array of functions.<br>
**`beforeHandler` is executed always after the `preHandler` hook.**

```js
app.addHook('preHandler', (request, reply, done) => {
  // your code
  done()
})

app.route({
  method: 'GET',
  url: '/',
  beforeHandler: function (request, reply, done) {
    // your code
    done()
  },
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})

app.route({
  method: 'GET',
  url: '/',
  beforeHandler: [
    function first (request, reply, done) {
      // your code
      done()
    },
    function second (request, reply, done) {
      // your code
      done()
    }
  ],
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})
```
