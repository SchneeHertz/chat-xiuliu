const fs = require('node:fs')
const path = require('node:path')
const google = require('@schneehertz/google-it')
const axios = require('axios')
const { convert } = require('html-to-text')
const { getQuickJS, shouldInterruptAfterDeadline  } = require('quickjs-emscripten')
let { config: { proxyObject, proxyString, AI_NAME, writeFolder } } = require('../utils/loadConfig.js')

const { sliceStringbyTokenLength } = require('./tiktoken.js')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

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
    "name": "getContentOfWebpage",
    "description": "get text content of webpage based on url.",
    "parameters": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The url of webpage",
        },
      },
      "required": ["url"],
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
  {
    "name": "writeFileToDisk",
    "description": "Write file to disk.",
    "parameters": {
      "type": "object",
      "properties": {
        "relativeFilePath": {
          "type": "string",
          "description": "Relative file path, relative to the storage folder",
        },
        "content": {
          "type": "string",
          "description": "The content of file",
        }
      },
      "required": ["relativeFilePath", "content"],
    }
  },
  {
    "name": "readFileFromDisk",
    "description": "read file from disk.",
    "parameters": {
      "type": "object",
      "properties": {
        "filePath": {
          "type": "string",
          "description": "The path of file to read",
        }
      },
      "required": ["filePath"],
    }
  },
  {
    "name": "javaScriptInterpreter",
    "description": "Useful for running JavaScript code in sandbox. Input is a string of JavaScript code, output is the result of the code.",
    "parameters": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "The javascript code to run",
        }
      },
      "required": ["code"],
    }
  },
]

const functionAction = {
  getInformationFromGoogle({ queryString }) {
    return `${AI_NAME}正在搜索 ${queryString}`
  },
  getContentOfWebpage({ url }) {
    return `${AI_NAME}正在访问 ${url}`
  },
  getHistoricalConversationContent({ relatedText }) {
    return `${AI_NAME}想起了关于 ${relatedText} 的事情`
  },
  writeFileToDisk({ relativeFilePath, content }) {
    return `${AI_NAME}保存\n${content}\n到 ${relativeFilePath}`
  },
  readFileFromDisk ({ filePath }) {
    return `${AI_NAME}读取了 ${filePath}`
  },
  javaScriptInterpreter({ code }) {
    return `${AI_NAME}运行了\n${code}`
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
  return googleRes.map(l=>`[${l.title}](${l.link}): ${l.snippet}`).join('\n##\n')
}

const getContentOfWebpage = async ({ url }) => {
  return await axios.get(url, { proxy: proxyObject })
    .then(async res=>{
      let html = await res.data
      let content = convert(html, {
        baseElements: { selectors: ['p'] },
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
        ]
      })
      return sliceStringbyTokenLength(content, 1800)
    })
    .catch(err=>console.log(err))
}

const getHistoricalConversationContent = async ({ relatedText, dbTable }) => {
  let MemoryTexts = await dbTable.search(relatedText).limit(2).execute()
  return MemoryTexts.map(s => s.text).join('\n')
}

if (!writeFolder) writeFolder = path.join(STORE_PATH, 'storage')
const writeFileToDisk = async ({ relativeFilePath, content }) => {
  let writeFilepath = path.join(writeFolder, relativeFilePath)
  await fs.promises.mkdir(path.dirname(writeFilepath), { recursive: true })
  await fs.promises.writeFile(writeFilepath, content)
  return writeFilepath
}

const readFileFromDisk = async ({ filePath }) => {
  return await fs.promises.readFile(filePath, { encoding: 'utf-8' })
}

const javaScriptInterpreter = async ({ code }) => {
  const quickjs = await getQuickJS()
  return quickjs.evalCode(code, {
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 10000),
    memoryLimitBytes: 100 * 1024 * 1024,
  })
}

module.exports = {
  functionInfo,
  functionAction,
  functionList: {
    getInformationFromGoogle,
    getContentOfWebpage,
    getHistoricalConversationContent,
    writeFileToDisk,
    readFileFromDisk,
    javaScriptInterpreter
  }
}