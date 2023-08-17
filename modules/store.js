const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = app.getPath('userData')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

let storeData
try {
  storeData = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'storeData.json'), {encoding: 'utf-8'}))
} catch {
  storeData = {
    history: []
  }
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), {encoding: 'utf-8'})
}

const getStore = (key, defaultValue)=>{
  return storeData[key] || defaultValue
}

const setStore = (key, value)=>{
  storeData[key] = value
  fs.writeFileSync(path.join(STORE_PATH, 'storeData.json'), JSON.stringify(storeData, null, '  '), {encoding: 'utf-8'})
}

module.exports = {
  getStore,
  setStore
}

