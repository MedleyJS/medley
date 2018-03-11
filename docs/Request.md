# Request

Request is a core Medley object that is passed as the first argument to hooks and handlers.

**Properties:**

+ [`.body`](#requestbody)
+ [`.headers`](#requestheaders)
+ [`.method`](#requestmethod)
+ [`.params`](#requestparams)
+ [`.query`](#requestquery)
+ [`.req`](#requestreq)
+ [`.url`](#requesturl)

## Properties

### `request.body`

The parsed body of the request. Is `undefined` if there was no request body or if parsing the body failed.

```js
app.post('/user', (request, reply) => {
  request.body // { name: 'medley', email: 'medley@example.com' }
})
```

See the [`Body Parser`](BodyParser.md) documentation for information on how to implement custom body parsers.

Note that `request.body` is set back to `undefined` when the response is sent
(after `onSend` hooks) to save memory.

### `request.headers`

The request's HTTP headers. It is an object mapping header names to values. Header names are lower-cased.

```js
request.headers
// { 'user-agent': 'curl/7.22.0',
//   host: '127.0.0.1:8000',
//   accept: '*/*' }
```

### `request.method`

**Read-only**

The request's HTTP method as a string.

```js
request.method // 'GET'
```

### `request.params`

An object of the parameters matched in the URL.

```js
app.get('/:user', (request, reply) => {
  // If the request URL is '/100'
  request.params.user // '100'
})
```

### `request.query`

Object parsed from the query string. If there was no query string, the object will be empty.

```js
// If the URL path is '/path?a=1&b=value'
request.query // { a: '1', b: 'value' }
```

### `request.req`

The [`http.IncomingMessage`](https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_incomingmessage)
object from Node core.

### `request.url`

**Read-only**

Request URL string. This contains only the URL that is present in the actual HTTP request.

If the request is:

```
GET /status/user?name=medley HTTP/1.1\r\n
Accept: text/plain\r\n
\r\n
```

Then `request.url` will be:

```js
'/status/user?name=medley'
```
