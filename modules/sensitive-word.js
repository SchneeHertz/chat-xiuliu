const fs = require('node:fs')
const path = require('node:path')
const { Mint } = require('mint-filter')

const prepareMint = () => {
  let sensitiveWordList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/sensitive-word.json'), { encoding: 'utf-8' }))
  return new Mint(sensitiveWordList, { customCharacter: '哔' })
}

module.exports = {
  prepareMint
}