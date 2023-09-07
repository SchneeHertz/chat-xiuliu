const fs = require('node:fs')
const path = require('node:path')
const google = require('@schneehertz/google-it')
const axios = require('axios')
const { convert } = require('html-to-text')
const { getQuickJS, shouldInterruptAfterDeadline  } = require('quickjs-emscripten')
const { shell } = require('electron')
const { js: beautify } = require('js-beautify/js')

let { config: { useProxy, proxyObject, AI_NAME, writeFolder, allowPowerfulInterpreter } } = require('../utils/loadConfig.js')
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

const { sliceStringbyTokenLength } = require('./tiktoken.js')
const { javaScriptInterpreterPowerful } = require('./vm.js')

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
  {
    "name": "openLocalFileOrWebpage",
    "description": "Open local file or webpage, display it to the user",
    "parameters": {
      "type": "object",
      "properties": {
        "filePath": {
          "type": "string",
          "description": "The path of file to open",
        },
        "url": {
          "type": "string",
          "description": "The url of webpage to open",
        },
        "type": {
          "type": "string",
          "description": "The type of file to open",
          "enum": ["file", "webpage"],
        }
      },
      "required": ["type"],
    }
  }
]

if (allowPowerfulInterpreter) {
  let findExistInterpreter = functionInfo.findIndex(f => f.name === 'javaScriptInterpreter')
  if (findExistInterpreter !== -1) {
    functionInfo.splice(findExistInterpreter, 1, {
      "name": "javaScriptInterpreterPowerful",
      "description": `Useful for running JavaScript code in node.js VM.
Input is a string of JavaScript code, output is the result of the code.
You can require node modules except fs, and use lodash, axios directly.
The context of the VM will be preserved, you can store global variables for future use.`,
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
    })
  }
}

const functionAction = {
  getInformationFromGoogle ({ queryString }) {
    return `${AI_NAME}正在搜索 ${queryString}`
  },
  getContentOfWebpage ({ url }) {
    return `${AI_NAME}正在访问 ${url}`
  },
  getHistoricalConversationContent ({ relatedText }) {
    return `${AI_NAME}想起了关于 ${relatedText} 的事情`
  },
  writeFileToDisk ({ relativeFilePath, content }) {
    return `${AI_NAME}保存\n${content}\n到 ${relativeFilePath}`
  },
  readFileFromDisk ({ filePath }) {
    return `${AI_NAME}读取了 ${filePath}`
  },
  javaScriptInterpreter ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\`\`\`javascript\n${code}\n\`\`\``
  },
  javaScriptInterpreterPowerful ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\`\`\`javascript\n${code}\n\`\`\``
  },
  openLocalFileOrWebpage ({ filePath, url, type }) {
    return `${AI_NAME}打开了 ${type === 'file' ? filePath : url}`
  }
}

const getInformationFromGoogle = async ({ queryString }) => {
  let options = { proxy: useProxy ? proxyString : undefined }
  let additionalQueryParam = {
    // lr: 'lang_zh-CN',
    // hl: 'zh-CN',
    // cr: 'countryCN',
    // gl: 'cn',
    safe: 'high'
  }
  let googleRes = await google({ options, disableConsole: true, query: queryString, limit: 5, additionalQueryParam })
  return googleRes.map(l=>`[${l.title}](${l.link}): ${l.snippet}`).join('\n##\n')
}

const getContentOfWebpage = async ({ url }) => {
  return await axios.get(url, { proxy: useProxy ? proxyObject : undefined })
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
  let result = quickjs.evalCode(code, {
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 10000),
    memoryLimitBytes: 100 * 1024 * 1024,
  })
  return JSON.stringify(result)
}

const openLocalFileOrWebpage = async ({ filePath, url, type }) => {
  if (type === 'file') {
    shell.openPath(filePath)
  } else {
    shell.openExternal(url)
  }
  return `${AI_NAME}打开了 ${type === 'file' ? filePath : url}`
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
    javaScriptInterpreter,
    javaScriptInterpreterPowerful,
    openLocalFileOrWebpage
  }
}