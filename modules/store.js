const path = require('node:path')
const fs = require('node:fs')

const { STORE_PATH } = require('../utils/fileTool.js')

let storeData
try {
  storeData = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'storeData.json'), { encoding: 'utf-8' }))
} catch {
  storeData = {
    history: [],
    liveHistory: [],
    LIVE_ROOM_CODE: 0,
    authBody: {},
    scriptSystemPrompt: ''
  }
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), { encoding: 'utf-8' })
}

const getStore = (key, defaultValue) => {
  return JSON.parse(JSON.stringify(storeData[key])) || defaultValue
}

const setStore = (key, value) => {
  storeData[key] = value
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), { encoding: 'utf-8' })
}

module.exports = {
  getStore,
  setStore
}

