'use strict'

const runHooks = require('./HookRunners').onRequestPreHandlerHookRunner

function routeHandler(req, res, params, context) {
  var request = new context.Request(req, req.headers, params)
  var reply = new context.Reply(res, request, context.config, context)

  res._onResponseHooks = undefined
  if (context.onResponse !== null) {
    res._onResponseHooks = context.onResponse
    res.on('finish', runOnResponseHooks)
    res.on('error', runOnResponseHooks)
  }

  if (context.onRequest === null) {
    context.methodHandler(reply)
  } else {
    runHooks(context.onRequest, reply, context.methodHandler)
  }
}

function runOnResponseHooks() {
  this.removeListener('finish', runOnResponseHooks)
  this.removeListener('error', runOnResponseHooks)

  const onResponseHooks = this._onResponseHooks
  for (var i = 0; i < onResponseHooks.length; i++) {
    onResponseHooks[i](this)
  }
}

const methodHandlers = {
  GET: runPreHandlerHooks,
  HEAD: runPreHandlerHooks,
  POST: handlePostPutPatch,
  PUT: handlePostPutPatch,
  PATCH: handlePostPutPatch,
  OPTIONS: handleOptionsDelete,
  DELETE: handleOptionsDelete,
}

/**
 * Determine when to parse a body based on RFC 7230:
 * https://tools.ietf.org/html/rfc7230#section-3.3
 */

function handlePostPutPatch(reply) {
  var {request, _context: context} = reply
  var {headers} = request

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], -1, request, reply, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      reply.code(400).error(new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  if (headers['content-type'] === undefined && contentLength === 0) {
    runPreHandlerHooks(reply, context)
  } else {
    context.bodyParser
      .run(headers['content-type'], contentLength, request, reply, runPreHandlerHooks)
  }
}

/**
 * Following https://tools.ietf.org/html/rfc7231#section-4.3.7, only
 * parse the body of an OPTIONS request if it has a Content-Type.
 * Sometimes it's helpful to send a body with a DELETE request,
 * so treat it the same as an OPTIONS request.
 */
function handleOptionsDelete(reply) {
  var {request, _context: context} = reply
  var {headers} = request

  if (headers['content-type'] === undefined) {
    runPreHandlerHooks(reply, context)
    return
  }

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], -1, request, reply, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      reply.code(400).error(new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  context.bodyParser.run(headers['content-type'], contentLength, request, reply, runPreHandlerHooks)
}

function runPreHandlerHooks(reply) {
  if (reply._context.preHandler === null) {
    runHandler(reply)
  } else {
    runHooks(reply._context.preHandler, reply, runHandler)
  }
}

function runHandler(reply) {
  var result = reply._context.handler(reply.request, reply)
  if (result && typeof result.then === 'function') {
    result
      .then((payload) => {
        if (payload !== undefined) {
          reply.send(payload)
        }
      }, (err) => {
        reply.sent = false
        reply.error(err)
      })
  }
}

function defaultNotFoundHandler(request, reply) {
  reply.code(404).send(`Not Found: ${request.method} ${request.url}`)
}

function notFoundFallbackHandler(req, res) {
  const payload = `Unsupported request method: ${req.method}`
  res.writeHead(501, { // Not Implemented
    'Content-Type': 'text/plain',
    'Content-Length': '' + Buffer.byteLength(payload),
  })
  res.end(payload)
}

module.exports = {
  routeHandler,
  methodHandlers,
  defaultNotFoundHandler,
  notFoundFallbackHandler,
}
