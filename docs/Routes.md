# Defining Routes

To define routes, Medley supports both a *Hapi*-like [`.route()` method](#route-method) and
also *Express/Restify*-like [shorthand methods](#shorthand-methods) such as `.get()`.

## Route Method

```js
app.route(options)
```

### Options

+ `method`: The name of an HTTP method or an array of methods. The supported methods are:
  + `'GET'`
  + `'HEAD'`
  + `'POST'`
  + `'PUT'`
  + `'PATCH'`
  + `'DELETE'`
  + `'OPTIONS'`
+ `path`: The path to match the URL of the request.
+ `url`: Alias for `path`.
+ `responseSchema`: The schema for a JSON response. See the [`Serialization` documentation](Serialization.md).
+ `beforeHandler(request, response, next)`: A [function](Hooks.md#before-handler) or an array of functions called just before the request handler. `beforeHandler` functions are treated just like `preHandler` hooks.
+ `handler(request, response)`: The main function that will handle the request.
+ `bodyLimit`: Limits request bodies to this number of bytes. Must be an integer. Used to override the `bodyLimit` option passed to the [`Medley factory function`](Factory.md#bodylimit).
+ `config`: Object used to store custom configuration. Defaults to an empty object (`{}`).

`request` is defined in [Request](Request.md).

`response` is defined in [Response](Response.md).


Example:

```js
app.route({
  method: 'GET',
  path: '/',
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  },
  handler(request, response) {
    response.send({ hello: 'world' })
  }
})

app.route({
  method: ['POST', 'PUT'],
  path: '/comment',
  beforeHandler: function(request, response, next) {
    // Validate the request
    next()  
  },
  handler: function(request, response) {
    // Create a user comment
  }  
})
```

## Shorthand Methods

```js
app.get(path, [options], handler)
app.head(path, [options], handler)
app.post(path, [options], handler)
app.put(path, [options], handler)
app.patch(path, [options], handler)
app.delete(path, [options], handler)
app.options(path, [options], handler)
```

Example:

```js
const beforeHandler = [
  function authenticate(request, response, next) { ... },
  function validate(request, response, next) { ... },
]
app.get('/', { beforeHandler }, (request, response) => {
  response.send({ hello: 'world' })
})
```

Additionally, there is an `app.all()` shorthand method that will register a handler for all of the supported methods.

```js
app.all(path, [options], handler)
```

## URL-building
Medley supports both static and dynamic urls.<br>
To register a **parametric** path, use the *colon* before the parameter name. For **wildcard** use the *star*.
*Remember that static routes are always checked before parametric and wildcard.*

```js
// parametric
app.get('/example/:userId', (request, response) => {}))
app.get('/example/:userId/:secretToken', (request, response) => {}))

// wildcard
app.get('/example/*', (request, response) => {}))
```

Regular expression routes are supported as well, but pay attention, RegExp are very expensive in term of performance!
```js
// parametric with regexp
app.get('/example/:file(^\\d+).png', (request, response) => {}))
```

It's possible to define more than one parameter within the same couple of slash ("/"). Such as:
```js
app.get('/example/near/:lat-:lng/radius/:r', (request, response) => {}))
```
*Remember in this case to use the dash ("-") as parameters separator.*

Finally it's possible to have multiple parameters with RegExp.
```js
app.get('/example/at/:hour(^\\d{2})h:minute(^\\d{2})m', (request, response) => {}))
```
In this case as parameter separator it's possible to use whatever character is not matched by the regular expression.

Having a route with multiple parameters may affect negatively the performance, so prefer single parameter approach whenever possible, especially on routes which are on the hot path of your application.
If you are interested in how we handle the routing, checkout [find-my-way](https://github.com/delvedor/find-my-way).

<a id="async-await"></a>
## Async-Await / Promises

Medley has a convenient feature for `async` functions. If an `async` function returns a value,
it will be sent automatically.

```js
// Using response.send()
app.get('/', async (request, response) => {
  const data = await getDataAsync()
  response.send(data)
})

// Using return
app.get('/', async (request, response) => {
  const data = await getDataAsync()
  return data
})
```

This means that using `async-await` might not be needed at all since awaitable
functions return a promise, which can be returned from a normal function:

```js
app.get('/', (request, response) => {
  return getDataAsync()
})
```

The default status code for responses is `200`. If needed, use `response.status()`
to set the status code before returning:

```js
app.post('/user', (request, response) => {
  response.status(201) // 201 Created
  return createUserAsync()
})
```

Note that `response.send()` will not be called automatically if the value returned from an `async` function is `undefined`. This is because returning `undefined` is the same as not returning anything all (see the [MDN `return` documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return#wikiArticle)).

**Warning:** An error will be thrown if `return someValue` and `response.send()` are used at the same time because a response cannot be sent twice.

## Route Prefixing
Sometimes you need to maintain two or more different versions of the same api, a classic approach is to prefix all the routes with the api version number, `/v1/user` for example.
Medley offers you a fast and smart way to create different version of the same api without changing all the route names by hand, *route prefixing*. Let's see how it works:

```js
// server.js
const app = require('@medley/medley')()

app.register(require('./routes/v1/users'), { prefix: '/v1' })
app.register(require('./routes/v2/users'), { prefix: '/v2' })

app.listen(3000)
```
```js
// routes/v1/users.js
module.exports = function(app, opts, next) {
  app.get('/user', handler_v1)
  next()
}
```
```js
// routes/v2/users.js
module.exports = function(app, opts, next) {
  app.get('/user', handler_v2)
  next()
}
```
Medley will not complain because you are using the same name for two different routes, because at compilation time it will handle the prefix automatically *(this also means that the performance will not be affected at all!)*.

Now your clients will have access to the following routes:
- `/v1/user`
- `/v2/user`

You can do this as many times as you want, it works also for nested `register` and routes parameter are supported as well.
Be aware that if you use [`fastify-plugin`](https://github.com/fastify/fastify-plugin) this option won't work.
