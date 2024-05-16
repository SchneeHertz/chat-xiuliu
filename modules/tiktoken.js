const { getEncoding } = require('js-tiktoken')

const tokenizer = getEncoding('o200k_base')

const getTokenLength = (str = '') => {
  return tokenizer.encode(str).length
}

/**
 * Slices a given string by a specified token length.
 *
 * @param {string} str - The string to be sliced.
 * @param {number} length - The length of the token.
 * @return {string} The sliced string.
 */
const sliceStringbyTokenLength = (str, length) => {
  let resultParts = []
  let currentLength = 0
  let strSplitList = str.split(/\n/)

  for (let part of strSplitList) {
    currentLength += getTokenLength(part)
    if (currentLength > length) {
      break
    }
    resultParts.push(part)
  }
  return resultParts.join('')
}

module.exports = {
  getTokenLength,
  sliceStringbyTokenLength
}