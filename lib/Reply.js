'use strict'

const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./runHooks')

const {serialize} = require('./Serializer')

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    statusCode: {type: 'number'},
    error: {type: 'string'},
    message: {type: 'string'},
  },
})

function Reply(res, request, config, context) {
  this.res = res
  this.request = request
  this.config = config
  this._context = context
  this._customError = false
  this._ranHooks = false
  this.sent = false
  this.payload = undefined
}

Reply.buildReply = function(ParentReply) {
  function _Reply(res, request, config, context) {
    this.res = res
    this.request = request
    this.config = config
    this._context = context
    this._customError = false
    this.sent = false
    this.payload = undefined
  }

  _Reply.prototype = new ParentReply()
  _Reply.prototype.constructor = _Reply

  return _Reply
}

Reply.prototype.code = function(code) {
  this.res.statusCode = code
  return this
}

Reply.prototype.getHeader = function(name) {
  return this.res.getHeader(name)
}

Reply.prototype.setHeader = function(name, value) {
  this.res.setHeader(name, value)
  return this
}

Reply.prototype.appendHeader = function(name, val) {
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
}

Reply.prototype.type = function(type) {
  this.res.setHeader('Content-Type', type)
  return this
}

Reply.prototype.redirect = function(code, url) {
  if (url === undefined) {
    url = code
    code = 302
  }

  this.res.statusCode = code
  this.res.setHeader('Location', url)
  this.send()
}

Reply.prototype.error = function(err) {
  if (this.sent) {
    throw new Error('Cannot call reply.error() when a response has already been sent')
  }

  handleError(this, err)
}

Reply.prototype.send = function(payload) {
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
}

function runOnSendHooks(reply, payload) {
  if (reply._context.onSend === null || reply._ranHooks) {
    onSendEnd(reply, payload)
  } else {
    reply.payload = payload
    reply._ranHooks = true
    runHooks(
      reply._context.onSend,
      hookIterator,
      reply,
      wrapOnSendEnd
    )
  }
}

function hookIterator(fn, reply, next) {
  return fn(reply.request, reply, next)
}

function wrapOnSendEnd(err, reply) {
  if (err) {
    reply.res.statusCode = 500
    handleError(reply, err)
  } else {
    onSendEnd(reply, reply.payload)
  }
}

function onSendEnd(reply, payload) {
  if (payload === undefined || payload === null) {
    reply.res.end()
    return
  }

  if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) {
    if (typeof payload.pipe === 'function') {
      sendStream(payload, reply.res, reply)
      return
    }

    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
  }

  if (!reply.res.hasHeader('content-length')) {
    reply.res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  }

  reply.res.end(payload)
}

function sendStream(payload, res, reply) {
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, function(err) {
    sourceOpen = false
    if (!err) {
      return
    }

    if (res.headersSent) { // HELP WANTED: Need a test case where this is true
      res.destroy()
    } else {
      handleError(reply, err)
    }
  })

  eos(res, function(err) {
    if (!err) {
      return
    }

    // HELP WANTED: Need a test case where `res.headersSent` is `true` here

    if (sourceOpen) {
      if (payload.destroy) {
        payload.destroy()
      } else if (typeof payload.close === 'function') {
        payload.close(noop)
      } else if (typeof payload.abort === 'function') {
        payload.abort()
      }
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

    if (reply.res.hasHeader('content-type')) {
      reply.res.removeHeader('content-type')
    }

    var result = customErrorHandler(error, reply.request, reply)
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

  if (reply.res.hasHeader('content-type')) {
    reply.res.removeHeader('content-type')
  }

  reply._context = reply._context.notFoundContext
  reply._context.handler(reply.request, reply)
}

function noop() {}

module.exports = Reply
