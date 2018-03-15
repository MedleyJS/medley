'use strict'

const RouteContext = {
  create(app, jsonSerializers, methodHandler, handler, config, bodyLimit) {
    return {
      jsonSerializers,
      methodHandler,
      handler,
      config,
      parserOptions: {
        limit: bodyLimit || null,
      },
      Response: app._Response,
      Request: app._Request,
      bodyParser: app._bodyParser,
      errorHandler: app._errorHandler,
      onRequest: null,
      preHandler: null,
      onSend: null,
      onFinished: null,
      notFoundContext: null,
    }
  },
}

module.exports = RouteContext
