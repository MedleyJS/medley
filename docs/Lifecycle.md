# Lifecycle

```
Incoming Request
  │
  └─▶ Routing
        │
        └─▶ onRequest Hook
              │
              └─▶ Body Parsing
                    │
                    ├─▶ preHandler Hook
                    |     │
                    |     ├─▶ beforeHandler
                    |     |     │
              Error └ ─ ─ ┼ ─ ─ ┼─▶ Route Handler / Not-Found Handler / Error Handler
                          |     |     │
               Early Send └ ─ ─ ┴ ─ ─ ┴─▶ Serialize Payload
                                            │
                                            └─▶ onSend Hook
                                                  │
                                                  └─▶ Send Response
                                                        │
                                                        └─▶ onResponse Hook
```

## Routing

The first step Medley takes after receiving a request is to look up a route that matches the URL of the request.

If no route matches the request, a not-found handler that matches the URL is selected (or the default not-found handler if none set with [`app.setNotFoundHandler()`](Server-Methods.md#set-not-found-handler) were a match).

If the request method is not one of the [supported HTTP methods](Routes.md), a `404 Not Found` error response is sent immediately and the entire lifecycle is skipped. 

## `onRequest` Hook

Next, the `onRequest` hooks are run.

```js
app.addHook('onRequest', (req, res, next) => {
  next()
})
```

These hooks may send an early response with `res.end()`. If a hooks does this, the rest of the lifecycle will be skipped except for the `onResponse` hooks.

If an error occurs during a hook, the rest of the lifecycle up to the *Route Handler* is skipped and the error handler is invoked as the *Route Handler*.

## Body Parsing

In this step, a [`ContentTypeParser`](ContentTypeParser.md) is used to parse the body of the request and set `request.body`.

Body parsing is skipped if the request method is `GET` or `HEAD`.

A `415 Unsupported Media Type` error is thrown if the request has a body but there is no parser that matches the `Content-Type` header of the request.

If an error occurs while parsing the request body (including the `415` error mentioned above), the rest of the lifecycle up to the *Route Handler* is skipped and the error handler is invoked as the *Route Handler*.

## `preHandler` Hook

Next, the `preHandler` hooks are run.

```js
app.addHook('preHandler', (request, reply, next) => {
  next()
})
```

These hooks may send an early response with `reply.send()`. If a hooks does this, the rest of the hooks will be skipped and the lifecycle will go straight to the *Serialize Payload* step.

If an error occurs during a hook, the rest of the lifecycle up to the *Route Handler* is skipped and the error handler is invoked as the *Route Handler*.

## `beforeHandler`

The *beforeHandlers* are treated exactly the same as the `preHandler` hooks. They are always run after the `preHandler` hooks.

```js
app.get('/', {
  beforeHandler: (request, reply, next) => {
    next()
  }
}, (request, reply) => { ... })
```

## Route Handler

This is the main handler for the route. The route handler sends the response payload.

```js
app.get('/', (request, reply) => {
  reply.send('payload')
})
```

## Serialize Payload

In this step, the payload that was passed to `reply.send()` is serialized (if it needs to be) and an appropriate `Content-Type` for the payload is set (if one was not already set).

See the [`reply.send()`](Reply.md#send) and [Serialization](Serialization.md) documentation for more information.

## `onSend` Hook

Next, the `onSend` hooks are run.

```js
app.addHook('onSend', (request, reply, payload, next) => {
  next()
})
```

If an error occurs during a hook, the rest of the hooks are skipped and the error handler is invoked. The `onSend` hooks will **not** be run again when the error response is sent.

## Send Response

The serialized payload is sent to the client. Medley handles this internally for you.

## `onResponse` Hook

Finally, the `onResponse` hooks are run.

```js
app.addHook('onResponse', (res) => {
  // Do something like log the response time
})
```
