const path = require('node:path')
const fs = require('node:fs')

let STORE_PATH = path.join(process.cwd(), 'data')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}

let config
try {
  config = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'config.json'), { encoding: 'utf-8' }))
} catch {
  config = {
    OPENAI_API_KEY: '',
    OPENAI_API_ENDPOINT: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-3.5-turbo-16k',
    useAzureOpenai: false,
    AZURE_OPENAI_KEY: '',
    AZURE_OPENAI_ENDPOINT: '',
    AZURE_API_VERSION: '',
    AZURE_CHAT_MODEL: '',
    AZURE_EMBEDDING_MODEL: '',
    AZURE_IMAGE_MODEL: '',
    ADMIN_NAME: 'Chell',
    AI_NAME: '休留',
    systemPrompt: '你是虚拟猫娘休留,以下是你在回复时应该遵循的规则:\n1.你能够灵活的运用猫娘的风格进行回复.\n2.调用函数来提高你的回复质量.\n3.使用markdown格式回复和显示图片.',
    useProxy: false,
    proxyObject: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890
    },
    SpeechSynthesisVoiceName: 'zh-CN-XiaoyiNeural',
    historyRoundLimit: 12,
    functionCallingRoundLimit: 3,
    disableFunctions: [],
    allowPowerfulInterpreter: false,
    searchResultLimit: 5,
    webPageContentTokenLengthLimit: 6000,
    writeFolder: '',
  }
  fs.writeFileSync(path.join(STORE_PATH, 'config.json'), JSON.stringify(config, null, '  '), { encoding: 'utf-8' })
}

module.exports = {
  config,
}