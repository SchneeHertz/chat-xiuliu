const path = require('node:path')
const fs = require('node:fs')
const { get } = require('lodash')

const { STORE_PATH } = require('../utils/fileTool.js')

let storeData
try {
  storeData = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'storeData.json'), { encoding: 'utf-8' }))
} catch {
  storeData = {
    history: []
  }
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), { encoding: 'utf-8' })
}

const getStore = (key) => {
  return JSON.parse(JSON.stringify(get(storeData, key, null)))
}

const setStore = (key, value) => {
  storeData[key] = value
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), { encoding: 'utf-8' })
}

module.exports = {
  getStore,
  setStore
}

