const fs = require('node:fs')
const path = require('node:path')
const axios = require('axios')
const { convert } = require('html-to-text')
const { getQuickJS, shouldInterruptAfterDeadline  } = require('quickjs-emscripten')
const { shell } = require('electron')
const { js: beautify } = require('js-beautify/js')
const dayjs = require('dayjs')

let { config: { useProxy, proxyObject, AI_NAME, writeFolder, allowPowerfulInterpreter, CustomSearchAPI } } = require('../utils/loadConfig.js')
const proxyString = `${proxyObject.protocol}://${proxyObject.host}:${proxyObject.port}`

const { sliceStringbyTokenLength } = require('./tiktoken.js')
const { nodejs_interpreter } = require('./vm.js')
const { openaiImageCreate } = require('./common.js')
const { STORE_PATH } = require('../utils/fileTool.js')

if (!writeFolder) writeFolder = path.join(STORE_PATH, 'storage')
if (!fs.existsSync(writeFolder)) {
  fs.mkdirSync(writeFolder)
}

const functionInfo = [
  {
    "name": "get_information_from_google",
    "description": "Fetch information from Google based on a query string",
    "parameters": {
      "type": "object",
      "properties": {
        "query_string": {
          "type": "string",
          "description": "The search term to lookup",
        },
      },
      "required": ["query_string"],
    }
  },
  {
    "name": "get_text_content_of_webpage",
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
    "name": "download_file_to_local",
    "description": "download file from url to local.",
    "parameters": {
      "type": "object",
      "properties": {
        "file_url": {
          "type": "string",
          "description": "The url of file",
        },
        "file_name": {
          "type": "string",
          "description": "The name of file",
        }
      },
      "required": ["file_url", "file_name"],
    }
  },
  {
    "name": "write_file_to_local",
    "description": "Write file to local disk.",
    "parameters": {
      "type": "object",
      "properties": {
        "relative_file_path": {
          "type": "string",
          "description": "Relative file path, relative to the storage folder",
        },
        "content": {
          "type": "string",
          "description": "The content of file",
        }
      },
      "required": ["relative_file_path", "content"],
    }
  },
  {
    "name": "read_file_from_local",
    "description": "read file from local disk.",
    "parameters": {
      "type": "object",
      "properties": {
        "file_path": {
          "type": "string",
          "description": "The path of file to read",
        }
      },
      "required": ["file_path"],
    }
  },
  {
    "name": "java_script_interpreter",
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
    "name": "open_local_file_or_webpage",
    "description": "Open local file or webpage, display it to the user",
    "parameters": {
      "type": "object",
      "properties": {
        "file_path": {
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
    "name": "create_image_use_GPT",
    "description": `Create image using gpt-image-1. If the description is not in English, then translate it.`,
    "parameters": {
      "type": "object",
      "properties": {
        "prompt": {
          "type": "string",
          "description": "A text description of the desired image(s). The maximum length is 32000 characters",
        },
        "background": {
          "type": "string",
          "description": "Allows to set transparency for the background of the generated image(s).",
          "enum": ["auto", "transparent", "opaque"],
        },
        "size": {
          "type": "string",
          "description": "The size of the generated images. Must be one of 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait), or auto (default value)",
          "enum": ["1024x1024", "1536x1024", "1024x1536", "auto"],
        },
        "quality": {
          "type": "string",
          "description": "The quality of the image that will be generated.auto (default value) will automatically select the best quality for the given model. high, medium and low are supported",
          "enum": ["auto", "high", "medium", "low"],
        },
        "n": {
          "type": "number",
          "description": "The number of images to generate. Must be between 1 and 10."
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
  let findExistInterpreter = functionInfo.findIndex(f => f.function.name === 'java_script_interpreter')
  if (findExistInterpreter !== -1) {
    functionInfo.splice(findExistInterpreter, 1, {
      type: 'function',
      function: {
        "name": "nodejs_interpreter",
        "description": `Useful for running JavaScript code in node.js(version 18) VM.
  You need to use global.variable = value when declaring global variables.
  Input is a string of JavaScript code, output is the result of the code.
  You can require node modules except fs, and use lodash directly.
  You can only store variables in the "global" object for future use, like "global.hello = function () {return 'hello'}"`,
        "parameters": {
          "type": "object",
          "properties": {
            "code": {
              "type": "string",
              "description": "The javascript code to run, write the result variable in the last line to output the result.",
            }
          },
          "required": ["code"],
        }
      }
    })
  }
}

const functionAction = {
  get_information_from_google ({ query_string }) {
    return `${AI_NAME}正在搜索 ${query_string}`
  },
  get_text_content_of_webpage ({ url }) {
    return `${AI_NAME}正在访问 ${url}`
  },
  download_file_to_local ({ file_url, file_name }) {
    return `${AI_NAME}下载了 ${file_url} 到 ${file_name}`
  },
  write_file_to_local ({ relative_file_path, content }) {
    return `${AI_NAME}保存\n\n${content}\n\n到 ${relative_file_path}`
  },
  read_file_from_local ({ file_path }) {
    return `${AI_NAME}读取了 ${file_path}`
  },
  java_script_interpreter ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\n\`\`\`javascript\n${code}\n\`\`\``
  },
  nodejs_interpreter ({ code }) {
    code = beautify(code, {
      indent_size: 2,
      space_after_anon_function: true,
      space_after_named_function: true,
    })
    return `${AI_NAME}运行了\n\n\`\`\`javascript\n${code}\n\`\`\``
  },
  open_local_file_or_webpage ({ file_path, url, type }) {
    return `${AI_NAME}请求打开 ${type === 'file' ? file_path : url}`
  },
  create_image_use_GPT ({ prompt, n, size, quality, background }) {
    return `${AI_NAME}正在生成${n ? n : 1}张\`${size ? size : 'auto'}\`大小,
质量为\`${quality ? quality : 'auto'}\`, 背景为\`${background ? background : 'auto'}\`的图片.
Prompt: \n\n\`\`\`json\n${prompt}\n\`\`\``
  }
}

const get_information_from_google = async ({ query_string }, { searchResultLimit }) => {
  const response = await axios.get(`${CustomSearchAPI}${encodeURIComponent(query_string)}`, {
    proxy: useProxy ? proxyObject : undefined
  })
  if (response.data.items) {
    return response.data.items.filter(i => i.title && i.snippet).map(i => `[${i.title}](${i.link}): ${i.snippet}`).slice(0, searchResultLimit).join('\n')
  } else {
    console.log('Google Search API Error:', response)
    return '没有找到相关信息'
  }
}

const get_text_content_of_webpage = async ({ url }, { webPageContentTokenLengthLimit }) => {
  return await axios.get(url, { proxy: useProxy ? proxyObject : undefined })
    .then(async res=>{
      let html = await res.data
      let content = convert(html, {
        baseElements: { selectors: ['dl', 'pre', 'p'] },
        wordwrap: false,
        selectors: [
          // { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
        ]
      })
      return sliceStringbyTokenLength(content, webPageContentTokenLengthLimit)
    })
}

const download_file_to_local = async ({ file_url, file_name }) => {
  let writefile_path = path.join(writeFolder, file_name)
  const response = await axios({
    method: 'GET',
    url: file_url,
    responseType: 'arraybuffer',
    proxy: useProxy ? proxyObject : undefined
  })
  await fs.promises.writeFile(writefile_path, response.data)
  return writefile_path
}

const write_file_to_local = async ({ relative_file_path, content }) => {
  let writefile_path = path.join(writeFolder, relative_file_path)
  await fs.promises.mkdir(path.dirname(writefile_path), { recursive: true })
  await fs.promises.writeFile(writefile_path, content)
  return writefile_path
}

const read_file_from_local = async ({ file_path }) => {
  return await fs.promises.readFile(file_path, { encoding: 'utf-8' })
}

const java_script_interpreter = async ({ code }) => {
  const quickjs = await getQuickJS()
  let result = quickjs.evalCode(code, {
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 10000),
    memoryLimitBytes: 100 * 1024 * 1024,
  })
  return JSON.stringify(result)
}

const open_local_file_or_webpage = async ({ file_path, url, type }) => {
  if (type === 'file') {
    shell.openPath(file_path)
  } else {
    shell.openExternal(url)
  }
  return `${AI_NAME}打开了 ${type === 'file' ? file_path : url}`
}

const _downloadImage = async (rsp) => {
  try {
    const fileId = dayjs().format('YYYYMMDDTHHmmssSSS')
    const image_base64 = rsp.data[0].b64_json
    const image_bytes = Buffer.from(image_base64, "base64")
    const imagePath = path.join(writeFolder, fileId + '_image.png')
    fs.writeFileSync(imagePath, image_bytes)
    await fs.promises.writeFile(path.join(writeFolder, fileId + '_prompt.txt'), rsp.revised_prompt)
  } catch (e) {
    console.error(e)
  }
}

const create_image_use_GPT = async ({ prompt, n, size, quality, background }) => {
  let result = await openaiImageCreate({
    prompt, n, size, quality, background
  })
  console.log(result)
  _downloadImage(result)
  return JSON.stringify(result)
}

module.exports = {
  functionInfo,
  functionAction,
  functionList: {
    get_information_from_google,
    get_text_content_of_webpage,
    download_file_to_local,
    write_file_to_local,
    read_file_from_local,
    java_script_interpreter,
    nodejs_interpreter,
    open_local_file_or_webpage,
    create_image_use_GPT
  }
}