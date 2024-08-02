const fs = require('node:fs')
const path = require('node:path')
const { Mint } = require('mint-filter')

const { STORE_PATH } = require('../utils/fileTool.js')

const prepareMint = () => {
  let sensitiveWordList = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'sensitive-word.json'), { encoding: 'utf-8' }))
  return new Mint(sensitiveWordList, { customCharacter: '哔' })
}

module.exports = {
  prepareMint
}