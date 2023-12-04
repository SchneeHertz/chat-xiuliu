const fs = require('node:fs')
const path = require('node:path')
const google = require('@schneehertz/google-it')
const axios = require('axios')
const { convert } = require('html-to-text')
const { getQuickJS, shouldInterruptAfterDeadline  } = require('quickjs-emscripten')
const { shell } = require('electron')
const { js: beautify } = require('js-beautify/js')
const dayjs = require('dayjs')

let { config: { useProxy, proxyObject, AI_NAME, writeFolder, allowPowerfulInterpreter, useAzureOpenai } } = require('../utils/loadConfig.js')
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

const { sliceStringbyTokenLength } = require('./tiktoken.js')
const { nodejsInterpreter } = require('./vm.js')
const { openaiImageCreate, azureOpenaiImageCreate } = require('./common.js')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}
if (!writeFolder) writeFolder = path.join(STORE_PATH, 'storage')
if (!fs.existsSync(writeFolder)) {
  fs.mkdirSync(writeFolder)
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
    "name": "getTextContentOfWebpage",
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
    "name": "downloadFileToLocal",
    "description": "download file from url to local.",
    "parameters": {
      "type": "object",
      "properties": {
        "fileUrl": {
          "type": "string",
          "description": "The url of file",
        },
        "fileName": {
          "type": "string",
          "description": "The name of file",
        }
      },
      "required": ["fileUrl", "fileName"],
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
    "name": "writeFileToLocal",
    "description": "Write file to local disk.",
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
    "name": "readFileFromLocal",
    "description": "read file from local disk.",
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
  },
  {
    "name": "createImageUseDALLE3",
    "description": `Create image using DALL·E 3.
If the description is not in English, then translate it.
Always mention the image type (photo, oil painting, watercolor painting, illustration, cartoon, drawing, vector, render, etc.) at the beginning of the caption.`,
    "parameters": {
      "type": "object",
      "properties": {
        "prompt": {
          "type": "string",
          "description": "A text description of the desired image",
        },
        "size": {
          "type": "string",
          "description": "The size of the generated images",
          "enum": ["1024x1024", "1792x1024", "1024x1792"],
        },
        "quality": {
          "type": "string",
          "description": "The quality of the image that will be generated",
          "enum": ["standard", "hd"],
        },
        "style": {
          "type": "string",
          "description": "The style of the generated images",
          "enum": ["vivid", "natural"]
        }
      },
      "required": ["prompt"],
    }
  }
].map(f => {
  return {
    type: 'function',
    function: f
  }
})

if (allowPowerfulInterpreter) {
  let findExistInterpreter = functionInfo.findIndex(f => f.function.name === 'javaScriptInterpreter')
  if (findExistInterpreter !== -1) {
    functionInfo.splice(findExistInterpreter, 1, {
      type: 'function',
      function: {
        "name": "nodejsInterpreter",
        "description": `Useful for running JavaScript code in node.js VM.
  Input is a string of JavaScript code, output is the result of the code.
  You can require node modules except fs, and use lodash directly.
  You can only store variables in the "global" object for future use, like "global.hello = function () {return 'hello'}"`,
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
      }
    })
  }
}

const functionAction = {
  getInformationFromGoogle ({ queryString }) {
    return `${AI_NAME}正在搜索 ${queryString}`
  },
  getTextContentOfWebpage ({ url }) {
    return `${AI_NAME}正在访问 ${url}`
  },
  downloadFileToLocal ({ fileUrl, fileName }) {
    return `${AI_NAME}下载了 ${fileUrl} 到 ${fileName}`
  },
  getHistoricalConversationContent ({ relatedText }) {
    return `${AI_NAME}想起了关于 ${relatedText} 的事情`
  },
  writeFileToLocal ({ relativeFilePath, content }) {
    return `${AI_NAME}保存\n\n${content}\n\n到 ${relativeFilePath}`
  },
  readFileFromLocal ({ filePath }) {
    return `${AI_NAME}读取了 ${filePath}`
  },
  javaScriptInterpreter ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\n\`\`\`javascript\n${code}\n\`\`\``
  },
  nodejsInterpreter ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\n\`\`\`javascript\n${code}\n\`\`\``
  },
  openLocalFileOrWebpage ({ filePath, url, type }) {
    return `${AI_NAME}请求打开 ${type === 'file' ? filePath : url}`
  },
  createImageUseDALLE3 ({ prompt, size, quality, style }) {
    return `${AI_NAME}正在生成一张\`${size ? size : '1024x1024'}\`大小,
质量为\`${quality ? quality : 'standard'}\`, 风格为\`${style ? style : 'vivid'}\`的图片.
Prompt: \n\n\`\`\`json\n${prompt}\n\`\`\``
  }
}

const getInformationFromGoogle = async ({ queryString }, { searchResultLimit }) => {
  let options = { proxy: useProxy ? proxyString : undefined }
  let additionalQueryParam = {
    // lr: 'lang_zh-CN',
    // hl: 'zh-CN',
    // cr: 'countryCN',
    // gl: 'cn',
    safe: 'high'
  }
  let googleRes = await google({ options, disableConsole: true, query: queryString, limit: searchResultLimit, additionalQueryParam })
  return googleRes.map(l=>`[${l.title}](${l.link}): ${l.snippet}`).join('\n')
}

const getTextContentOfWebpage = async ({ url }, { webPageContentTokenLengthLimit }) => {
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
      return sliceStringbyTokenLength(content, webPageContentTokenLengthLimit)
    })
}

const downloadFileToLocal = async ({ fileUrl, fileName }) => {
  let writeFilepath = path.join(writeFolder, fileName)
  const response = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'arraybuffer',
    proxy: useProxy ? proxyObject : undefined
  })
  await fs.promises.writeFile(writeFilepath, response.data)
  return writeFilepath
}

const getHistoricalConversationContent = async ({ relatedText, dbTable }) => {
  let MemoryTexts = await dbTable.search(relatedText).limit(2).execute()
  return MemoryTexts.map(s => s.text).join('\n')
}

const writeFileToLocal = async ({ relativeFilePath, content }) => {
  let writeFilepath = path.join(writeFolder, relativeFilePath)
  await fs.promises.mkdir(path.dirname(writeFilepath), { recursive: true })
  await fs.promises.writeFile(writeFilepath, content)
  return writeFilepath
}

const readFileFromLocal = async ({ filePath }) => {
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

const _downloadImage = async (result) => {
  try {
    const fileId = dayjs().format('YYYYMMDDTHHmmssSSS')
    await downloadFileToLocal({ fileUrl: result.url, fileName: fileId + '_image.png' })
    await fs.promises.writeFile(path.join(writeFolder, fileId + '_prompt.txt'), result.revised_prompt)
  } catch (e) {
    console.error(e)
  }
}

const createImageUseDALLE3 = async ({ prompt, size, quality, style }) => {
  let result
  if (useAzureOpenai) {
    result = await azureOpenaiImageCreate({
      prompt,
      size,
      quality,
      style
    })
  } else {
    result = await openaiImageCreate({
      prompt,
      size,
      quality,
      style
    })
  }
  _downloadImage(result)
  return JSON.stringify(result)
}

module.exports = {
  functionInfo,
  functionAction,
  functionList: {
    getInformationFromGoogle,
    getTextContentOfWebpage,
    downloadFileToLocal,
    getHistoricalConversationContent,
    writeFileToLocal,
    readFileFromLocal,
    javaScriptInterpreter,
    nodejsInterpreter,
    openLocalFileOrWebpage,
    createImageUseDALLE3
  }
}