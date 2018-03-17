'use strict'

const defineProperties = require('./utils/defineProperties')
const destroyStream = require('destroy')
const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./HookRunners').onSendHookRunner

const {defaultNotFoundHandler} = require('./RequestHandlers')
const {serialize} = require('./Serializer')

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    statusCode: {type: 'number'},
    error: {type: 'string'},
    message: {type: 'string'},
  },
})

module.exports = {
  buildResponse(ParentResponse) {
    function Response(stream, request, routeContext) {
      this.stream = stream
      this.request = request
      this.route = routeContext
      this.sent = false
      this._headers = {}
      this._customError = false
      this._ranHooks = false
    }

    if (ParentResponse === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Response.prototype, new Response(null, null, null))
      // eslint-disable-next-line no-use-before-define
      defineProperties(Response.prototype, ResponsePrototype)
    } else {
      Response.prototype = Object.create(ParentResponse.prototype)
    }

    return Response
  },
}

const ResponsePrototype = {
  headersSent: {
    get() {
      return this.stream.headersSent
    },
  },

  statusCode: {
    get() {
      return this.stream.statusCode
    },
    set(code) {
      this.stream.statusCode = code
    },
  },

  status(statusCode) {
    this.stream.statusCode = statusCode
    return this
  },

  get(field) {
    return this._headers[field.toLowerCase()]
  },

  set(field, value) {
    if (typeof field === 'string') {
      if (value === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }
      this._headers[field.toLowerCase()] = value
      return this
    }

    for (const name in field) {
      if (field[name] === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }
      this._headers[name.toLowerCase()] = field[name]
    }
    return this
  },

  append(field, value) {
    if (value === undefined) {
      throw new TypeError("Cannot set header value to 'undefined'")
    }

    field = field.toLowerCase()
    const curVal = this._headers[field]

    if (curVal !== undefined) {
      if (typeof curVal === 'string') {
        value = typeof value === 'string' ? [curVal, value] : [curVal].concat(value)
      } else {
        value = curVal.concat(value)
      }
    }

    this._headers[field] = value

    return this
  },

  remove(field) {
    delete this._headers[field]
    return this
  },

  type(contentType) {
    if (contentType === undefined) {
      throw new TypeError("Cannot set header value to 'undefined'")
    }
    this._headers['content-type'] = contentType
    return this
  },

  redirect(code, url) {
    if (url === undefined) {
      url = code
      code = 302
    }

    this.statusCode = code
    this._headers.location = url
    this.send()
  },

  error(statusCode, error) {
    if (this.sent) {
      throw new Error('Cannot call response.error() when a response has already been sent')
    }

    if (error === undefined) {
      error = statusCode
      statusCode = getErrorStatus(error)
    }

    if (statusCode === 404) {
      handle404(this)
      return
    }

    this.statusCode = statusCode

    var customErrorHandler = this.route.errorHandler
    if (customErrorHandler !== null && this._customError === false) {
      this._customError = true // Prevent the custom error handler from running again

      // Remove the current Content-Type so .send() doesn't assume the old type
      this.remove('content-type')

      var result = customErrorHandler(error, this.request, this)
      if (result && typeof result.then === 'function') {
        result.then((payload) => {
          if (payload !== undefined) {
            this.send(payload)
          }
        }, (err) => {
          if (this.sent) {
            throw err // Re-throw the error since it is a system error
          }
          this.error(err)
        })
      }
      return
    }

    this.sent = true

    var payload = serializeError({
      error: statusCodes['' + statusCode],
      message: error && error.message || '',
      statusCode,
    })
    flatstr(payload)

    this._headers['content-type'] = 'application/json'
    this._headers['content-length'] = '' + Buffer.byteLength(payload)

    runOnSendHooks(this, payload) // They won't run again if they already ran once
  },

  send(payload) {
    if (this.sent) {
      throw new Error('Cannot call response.send() when a response has already been sent')
    }

    this.sent = true

    if (payload === undefined) {
      runOnSendHooks(this, payload)
      return
    }

    var contentType = this._headers['content-type'] // Using var for perf

    if (contentType === undefined) {
      if (typeof payload === 'string') {
        this._headers['content-type'] = 'text/plain'
      } else if (
        payload !== null && (payload instanceof Buffer || typeof payload.pipe === 'function')
      ) {
        this._headers['content-type'] = 'application/octet-stream'
      } else {
        this._headers['content-type'] = 'application/json'
        payload = serialize(this.route, payload, this.stream.statusCode)
      }
    } else if (
      contentType === 'application/json' &&
      (payload === null || !(payload instanceof Buffer || typeof payload.pipe === 'function'))
    ) {
      payload = serialize(this.route, payload, this.stream.statusCode)
    }

    runOnSendHooks(this, payload)
  },
}

function runOnSendHooks(response, payload) {
  if (response.route.onSend === null || response._ranHooks) {
    sendFinalPayload(response, payload)
  } else {
    response._ranHooks = true
    runHooks(
      response.route.onSend,
      response,
      payload,
      sendFinalPayload
    )
  }
}

function sendFinalPayload(res, payload) {
  var req = res.request
  var headers = res._headers
  var {statusCode} = res

  if (req.body !== undefined) {
    req.body = undefined
  }

  if (payload === undefined || payload === null) {
    if (statusCode >= 200 && statusCode !== 204 && statusCode !== 304 && req.method !== 'HEAD') {
      headers['content-length'] = '0'
    }
  } else if (typeof payload === 'string' || payload instanceof Buffer) {
    if (headers['content-length'] === undefined) {
      headers['content-length'] = '' + Buffer.byteLength(payload)
    }
  } else {
    if (typeof payload.pipe === 'function') {
      sendStream(payload, res)
      return
    }

    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
  }

  res.stream.writeHead(statusCode, headers)
  res.stream.end(payload)
}

function sendStream(payload, res) {
  var resStream = res.stream
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, (err) => {
    sourceOpen = false
    if (!err) {
      return
    }

    if (resStream.headersSent) {
      resStream.destroy(err)
    } else {
      res.sent = false
      res.error(err)
    }
  })

  eos(resStream, (err) => {
    if (err && sourceOpen) {
      destroyStream(payload)
    }
  })

  // Must use implicit headers when piping to the response stream
  // in case the payload stream errors before headers are sent
  for (const name in res._headers) {
    resStream.setHeader(name, res._headers[name])
  }

  payload.pipe(resStream)
}

function getErrorStatus(error) {
  if (typeof error === 'object' && error !== null) {
    const status = error.status || error.statusCode
    // HTTP 2 allowed values - https://github.com/nodejs/node/blob/ffd618bd5cde77e19ab6458eaf454c4df71dd638/lib/internal/http2/core.js#L1925
    if (status >= 200 && status <= 599) {
      return status
    }
  }

  return 500 // Internal Server Error
}

function handle404(res) {
  res.sent = false

  // Remove the current Content-Type so .send() doesn't assume the old type
  res.remove('content-type')

  var {notFoundRouteContext} = res.route
  if (notFoundRouteContext === null) {
    // Not-found handler invoked inside a not-found handler, so call the default
    defaultNotFoundHandler(res.request, res)
    return
  }

  res.route = notFoundRouteContext // Replace the context before calling the handler
  var result = notFoundRouteContext.handler(res.request, res)

  if (result && typeof result.then === 'function') {
    result.then((payload) => {
      if (payload !== undefined) {
        res.send(payload)
      }
    }, (err) => {
      if (res.sent) {
        throw err // Re-throw the error since it is a system error
      }
      res.error(err)
    })
  }
}

// Aliases
ResponsePrototype.appendHeader = ResponsePrototype.append
ResponsePrototype.getHeader = ResponsePrototype.get
ResponsePrototype.removeHeader = ResponsePrototype.remove
ResponsePrototype.setHeader = ResponsePrototype.set
