const google = require('@schneehertz/google-it')
const { config: { proxyString, AI_NAME } } = require('../utils/loadConfig.js')

const functionInfo = [
  {
    "name": "getInformationFromGoogle",
    "description": "Fetch information from Google based on a query string",
    "parameters": {
      "type": "object",
      "properties": {
        "queryString": {
          "type": "string",
          "description": "The search term to lookup",
        },
      },
      "required": ["queryString"],
    }
  },
  {
    "name": "getHistoricalConversationContent",
    "description": "Searching historical conversation content in conversation history.",
    "parameters": {
      "type": "object",
      "properties": {
        "relatedText": {
          "type": "string",
          "description": "The related text to find historical conversation content",
        },
      },
      "required": ["relatedText"],
    }
  },
]

const functionAction = {
  getInformationFromGoogle({ queryString }) {
    return `${AI_NAME}正在搜索${queryString}`
  },
  getHistoricalConversationContent({ relatedText }) {
    return `${AI_NAME}想起了关于${relatedText}的事情`
  }
}

const getInformationFromGoogle = async ({ queryString }) => {
  let options = { proxy: proxyString }
  let additionalQueryParam = {
    lr: 'lang_zh-CN',
    hl: 'zh-CN',
    cr: 'countryCN',
    gl: 'cn',
    safe: 'high'
  }
  let googleRes = await google({ options, disableConsole: true, query: queryString, limit: 6, additionalQueryParam })
  // return googleRes.map(r=>r.snippet).join('\n').slice(0, 800)
  return googleRes.map(l=>l.title + '\n' + l.snippet).join('\n')
}

const getHistoricalConversationContent = async ({ relatedText, dbTable }) => {
  let MemoryTexts = await dbTable.search(relatedText).limit(2).execute()
  return MemoryTexts.map(s => s.text).join('\n')
}


module.exports = {
  functionInfo,
  functionAction,
  functionList: {
    getInformationFromGoogle,
    getHistoricalConversationContent
  }
}