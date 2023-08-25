const { getEncoding } = require('js-tiktoken')

const tokenizer = getEncoding('cl100k_base')

const getTokenLength = (str) => {
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
  let strSplitList = str.split(/(?=[^a-zA-Z0-9一-龟])/)
  let result = ''
  for (let part of strSplitList) {
    result += part
    if (getTokenLength(result) > length) {
      return result
    }
  }
  return result
}

module.exports = {
  getTokenLength,
  sliceStringbyTokenLength
}