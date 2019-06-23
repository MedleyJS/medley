'use strict'

const compileJSONStringify = require('compile-json-stringify')

// https://github.com/davidmarkclements/flatstr
function flatstr(str) {
  str | 0 // eslint-disable-line no-unused-expressions
  return str
}

function wrapSchema(schema) {
  return !schema.type && !schema.properties
    ? {type: 'object', properties: schema}
    : schema
}

function buildSerializers(responseSchema) {
  if (!responseSchema) {
    return null
  }

  const serializers = {}

  Object.keys(responseSchema).forEach((statusCode) => {
    const schema = wrapSchema(responseSchema[statusCode])
    serializers[statusCode] = compileJSONStringify(schema)
  })

  return serializers
}

function serialize(routeContext, payload, statusCode) {
  const serializers = routeContext.jsonSerializers

  return serializers !== null && serializers[statusCode] !== undefined
    ? flatstr(serializers[statusCode](payload))
    : JSON.stringify(payload)
}

module.exports = {buildSerializers, serialize}
