'use strict'

const defineProperties = require('./utils/defineProperties')
const destroyStream = require('destroy')
const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./HookRunners').onSendHookRunner

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
  buildReply(ParentReply) {
    function Reply(res, request, context) {
      this.res = res
      this._request = request
      this._context = context
      this.sent = false
      this._customError = false
      this._ranHooks = false
    }

    if (ParentReply === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Reply.prototype, {
        res: null,
        _request: null,
        _context: null,
        sent: false,
        _customError: false,
        _ranHooks: false,
      })
      // eslint-disable-next-line no-use-before-define
      defineProperties(Reply.prototype, ReplyPrototype)
    } else {
      Reply.prototype = Object.create(ParentReply.prototype)
    }

    return Reply
  },
}

const ReplyPrototype = {
  config: {
    get() {
      return this._context.config
    },
  },

  code(code) {
    this.res.statusCode = code
    return this
  },

  getHeader(name) {
    return this.res.getHeader(name)
  },

  setHeader(name, value) {
    this.res.setHeader(name, value)
    return this
  },

  appendHeader(name, val) {
    const curVal = this.res.getHeader(name)

    if (curVal === undefined) {
      this.res.setHeader(name, val)
    } else if (typeof curVal === 'string') {
      this.res.setHeader(
        name,
        typeof val === 'string' ? [curVal, val] : [curVal].concat(val)
      )
    } else {
      this.res.setHeader(name, curVal.concat(val))
    }

    return this
  },

  removeHeader(name) {
    this.res.removeHeader(name)
    return this
  },

  type(contentType) {
    this.res.setHeader('Content-Type', contentType)
    return this
  },

  redirect(code, url) {
    if (url === undefined) {
      url = code
      code = 302
    }

    this.res.statusCode = code
    this.res.setHeader('Location', url)
    this.send()
  },

  error(err) {
    if (this.sent) {
      throw new Error('Cannot call reply.error() when a response has already been sent')
    }

    handleError(this, err)
  },

  send(payload) {
    if (this.sent) {
      throw new Error('Cannot call reply.send() when a response has already been sent')
    }

    this.sent = true

    if (payload === undefined) {
      runOnSendHooks(this, payload)
      return
    }

    var contentType = this.res.getHeader('content-type') // Using var for perf

    if (contentType === undefined) {
      if (typeof payload === 'string') {
        this.res.setHeader('Content-Type', 'text/plain')
      } else if (
        payload !== null && (Buffer.isBuffer(payload) || typeof payload.pipe === 'function')
      ) {
        this.res.setHeader('Content-Type', 'application/octet-stream')
      } else {
        this.res.setHeader('Content-Type', 'application/json')
        payload = serialize(this._context, payload, this.res.statusCode)
      }
    } else if (
      contentType === 'application/json' &&
      (payload === null || (!Buffer.isBuffer(payload) && typeof payload.pipe !== 'function'))
    ) {
      payload = serialize(this._context, payload, this.res.statusCode)
    }

    runOnSendHooks(this, payload)
  },
}

function runOnSendHooks(reply, payload) {
  if (reply._context.onSend === null || reply._ranHooks) {
    onSendEnd(reply, payload)
  } else {
    reply._ranHooks = true
    runHooks(
      reply._context.onSend,
      reply,
      payload,
      wrapOnSendEnd
    )
  }
}

function wrapOnSendEnd(err, reply, payload) {
  if (err) {
    reply.res.statusCode = 500
    handleError(reply, err)
  } else {
    onSendEnd(reply, payload)
  }
}

function onSendEnd(reply, payload) {
  if (reply._request.body !== undefined) {
    reply._request.body = undefined
  }

  var {res} = reply

  if (payload === undefined || payload === null) {
    res.end()
    return
  }

  if (typeof payload !== 'string' && !(payload instanceof Buffer)) {
    if (typeof payload.pipe === 'function') {
      sendStream(payload, res, reply)
      return
    }

    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
  }

  if (res.getHeader('content-length') === undefined) {
    res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  }

  res.end(payload)
}

function sendStream(payload, res, reply) {
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, (err) => {
    sourceOpen = false
    if (!err) {
      return
    }

    if (res.headersSent) {
      res.destroy(err)
    } else {
      handleError(reply, err)
    }
  })

  eos(res, (err) => {
    if (err && sourceOpen) {
      destroyStream(payload)
    }
  })

  payload.pipe(res)
}

function handleError(reply, error) {
  var statusCode = reply.res.statusCode
  statusCode = (statusCode >= 400) ? statusCode : 500
  if (error != null) {
    if (error.status >= 400) {
      if (error.status === 404) {
        notFound(reply)
        return
      }
      statusCode = error.status
    } else if (error.statusCode >= 400) {
      if (error.statusCode === 404) {
        notFound(reply)
        return
      }
      statusCode = error.statusCode
    }
  }

  reply.res.statusCode = statusCode

  var customErrorHandler = reply._context.errorHandler
  if (customErrorHandler !== null && reply._customError === false) {
    reply.sent = false
    reply._customError = true

    if (reply.res.getHeader('content-type') !== undefined) {
      reply.res.removeHeader('content-type')
    }

    var result = customErrorHandler(error, reply._request, reply)
    if (result && typeof result.then === 'function') {
      result.then(
        reply.send.bind(reply),
        reply.error.bind(reply)
      )
    }
    return
  }

  reply.sent = true

  var payload = serializeError({
    error: statusCodes[statusCode + ''],
    message: error && error.message || '',
    statusCode,
  })
  flatstr(payload)
  reply.res.setHeader('Content-Type', 'application/json')

  if (reply._ranHooks === false && reply._context.onSend !== null) {
    runOnSendHooks(reply, payload)
    return
  }

  reply.res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  reply.res.end(payload)
}

function notFound(reply) {
  reply.sent = false

  if (reply._context.notFoundContext === null) {
    // Not-found handler invoked inside a not-found handler
    reply.code(404).type('text/plain').send('404 Not Found')
    return
  }

  if (reply.res.getHeader('content-type') !== undefined) {
    reply.res.removeHeader('content-type')
  }

  reply._context = reply._context.notFoundContext
  reply._context.handler(reply._request, reply)
}
