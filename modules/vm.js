const vm = require('node:vm')
const axios = require('axios')
const _ = require('lodash')

const env = {
  axios,
  _,
  lodash: _,
  require
}

const context = new vm.createContext(env)

const javaScriptInterpreterPowerful = ({ code }) => {
  const script = new vm.Script(code)
  let result = script.runInContext(context)
  return JSON.stringify(result)
}

module.exports = {
  javaScriptInterpreterPowerful
}