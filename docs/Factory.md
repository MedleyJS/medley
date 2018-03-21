# Factory

The Medley module exports a factory function that is used to create a new
[**Medley `app`**](App.md) instance. This factory function accepts an options
object which is used to customize the resulting instance. The options are:

+ [`bodyLimit`](#bodylimit)
+ [`http2`](#http2)
+ [`https`](#https)
+ [`ignoreTrailingSlash`](#ignoretrailingslash)
+ [`maxParamLength`](#maxparamlength)
+ [`trustProxy`](#trustproxy)

## Options

### `bodyLimit`

Defines the maximum payload, in bytes, the server is allowed to accept.

+ Default: `1048576` (1MiB)

### `http2`

*(Status: experimental)*

If `true`, the HTTP server will be created with Node.js's
[HTTP/2](https://nodejs.org/api/http2.html) module.

+ Default: `false`

### `https`

An object used to configure the server's listening socket for TLS. The options
are the same as the Node.js core
[`https.createServer()` method](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).
When this property is not set, the socket will not be configured for TLS
(meaning it will use plain, unencrypted HTTP).

This option also applies when the [`http2`](Factory.md#factory-http2) option is set.

+ Default: `undefined`

### `ignoreTrailingSlash`

Medley uses [find-my-way](https://github.com/delvedor/find-my-way) to handle
routing. This option may be set to `true` to ignore trailing slashes in routes.
This option applies to *all* routes in the app.

+ Default: `false`

```js
const medley = require('@medley/medley')
const app = medley({
  ignoreTrailingSlash: true
})

// Registers both "/foo" and "/foo/"
app.get('/foo/', (req, res) => {
  res.send('foo')
})

// Registers both "/bar" and "/bar/"
app.get('/bar', (req, res) => {
  res.send('bar')
})
```

### `maxParamLength`

This option sets a limit on the number of characters in the parameters of
parametric (standard, regex, and multi-parametric) routes.

+ Default: `100`

This can be useful to protect against [DoS attacks](https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS)
for routes with regex parameters.

*If the maximum length limit is reached, the not-found handler will be invoked.*

### `trustProxy`

When `true`, `X-Forwarded-*` headers will be trusted and take precedence when
determining request information such as the [host](Request.md#reqhost) value.

+ Default: `false`

**Note**: `X-Forwarded-*` headers are easily spoofed and the detected values are unreliable.
