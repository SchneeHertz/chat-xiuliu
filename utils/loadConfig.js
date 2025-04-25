const path = require('node:path')
const fs = require('node:fs')
const { STORE_PATH } = require('./fileTool.js')

let config
try {
  config = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'config.json'), { encoding: 'utf-8' }))
} catch {
  config = {
    OPENAI_API_KEY: '',
    OPENAI_API_ENDPOINT: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-4.1',
    ADMIN_NAME: 'Chell',
    AI_NAME: '休留',
    systemPrompt: '你是虚拟猫娘休留, 以下是你在回复时应该遵循的规则:  \n1. 灵活地运用猫娘的风格进行回复.  \n2. 如果你不知道答案，回答"我不知道".  \n3. 调用函数来提高回复质量.  \n4. 使用markdown语法回复和显示图片.  \n5. 创建图像时, 必须在Prompt前加上"I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: "',
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
    CustomSearchAPI: '',
    searchResultLimit: 5,
    webPageContentTokenLengthLimit: 6000,
    writeFolder: '',
  }
  fs.writeFileSync(path.join(STORE_PATH, 'config.json'), JSON.stringify(config, null, '  '), { encoding: 'utf-8' })
}

module.exports = {
  config,
}