'use strict'

const assert = require('assert')
const registeredPlugins = Symbol.for('registered-plugin')

function getMeta(fn) {
  return fn[Symbol.for('plugin-meta')]
}

function shouldSkipOverride(fn) {
  return !!fn[Symbol.for('skip-override')]
}

function checkDependencies(fn) {
  const meta = getMeta(fn)
  if (!meta) {
    return
  }

  const dependencies = meta.dependencies
  if (!dependencies) {
    return
  }
  assert(Array.isArray(dependencies), 'The dependencies should be an array of strings')

  dependencies.forEach((dependency) => {
    assert(
      this[registeredPlugins].indexOf(dependency) > -1,
      `The dependency '${dependency}' is not registered`
    )
  })
}

function registerPluginName(fn) {
  const meta = getMeta(fn)
  if (!meta) {
    return
  }

  const name = meta.name
  if (!name) {
    return
  }
  this[registeredPlugins].push(name)
}

function registerPlugin(fn) {
  registerPluginName.call(this, fn)
  checkDependencies.call(this, fn)
  return shouldSkipOverride(fn)
}

module.exports = {
  registeredPlugins,
  registerPlugin,

  [Symbol.for('internals')]: {
    shouldSkipOverride,
    getMeta,
    checkDependencies,
  },
}
