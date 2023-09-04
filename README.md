# chat-xiuliu

ChatGPT双向语音助手

这个项目是由虚拟猫娘休留(直播搞不下去了)的后台fork来的，去掉了弹幕互动的部分，增加了语音输入

截止到2023年8月15日，使用LLM模拟人格的尝试，在我这里没有看到效果及成本可以接受的希望。

所以模拟人格先放下一段时间，再看看未来LLM的发展吧

## 功能
- 从麦克风或界面接收问题
- 使用语音回答问题并显示在界面
- 调用函数处理任务
  - 连续调用函数处理
  - 对话内容回忆
  - 联网搜索关键词，获取网页内容
  - 读写本地文件
  - 在沙箱中执行JavaScript代码
  - 打开本地文件或网页
- 可定制的猫娘发言风格
- 支持Azure openai
- 支持兼容openai api格式的其他api端点
- 支持设置代理

![task_chains.jpg](https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/screenshots/task_chains.jpg)

## 使用说明
- 解压后打开chat-xiuliu.exe, 点击Open Config, 编辑配置文件
- 获取一个openai的API key, 填入配置文件中
- _下载[whisper-standalone-win](https://github.com/Purfview/whisper-standalone-win)r145.3(最好有张N卡，不然运行时很慢，可选，语音功能)_
  - _在whisper-standalone-win的Release和[huggingface](https://huggingface.co/guillaumekln)下载必要的文件，解压到resources/extraResources/whisper文件夹_
  ```
  resources/extraResources/whisper/_models/faster-whisper-large-v2/config.json
  resources/extraResources/whisper/_models/faster-whisper-large-v2/model.bin
  resources/extraResources/whisper/_models/faster-whisper-large-v2/tokenizer.json
  resources/extraResources/whisper/_models/faster-whisper-large-v2/vocabulary.txt
  resources/extraResources/whisper/cublas64_11.dll
  resources/extraResources/whisper/cublasLt64_11.dll
  resources/extraResources/whisper/cudnn_cnn_infer64_8.dll
  resources/extraResources/whisper/cudnn_ops_infer64_8.dll
  resources/extraResources/whisper/whisper-faster.exe
  resources/extraResources/whisper/zlibwapi.dll
  ```
- 修改配置文件的其他部分（可选）
  - 配置文件中本地代理的端口
  - 使用的模型，参考openai给出的[模型选项](https://platform.openai.com/docs/models/model-endpoint-compatibility)
  - 如果你使用Azure openai，将useAzureOpenai设为true，修改其他AZURE前缀的设置项，需要同时部署chat和embedding的模型
  - AI使用的名字和你的称呼
  - AI的语音模型，在[微软文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)查看可用值
  - AI的System Prompt(设定和发言风格)
- 保存配置文件后重启chat-xiuliu.exe
- 点击Speech Off切换录音开关，点击Audio Off切换语音开关

### 配置文件参考
```
{
  "OPENAI_API_KEY": "sk-and-48-chars",
  "OPENAI_API_ENDPOINT": "https://api.openai.com/v1",
  "DEFAULT_MODEL": "gpt-3.5-turbo-16k",
  "useAzureOpenai": false,
  "AZURE_OPENAI_KEY": "32-chars",
  "AZURE_OPENAI_ENDPOINT": "endpoint-name",
  "AZURE_API_VERSION": "2023-07-01-preview",
  "AZURE_CHAT_MODEL": "gpt-35-turbo-16k",
  "AZURE_EMBEDDING_MODEL": "text-embedding-ada-002",
  "SpeechSynthesisVoiceName": "zh-CN-XiaoyiNeural",
  "ADMIN_NAME": "Chell",
  "AI_NAME": "休留",
  "systemPrompt": "你是虚拟猫娘休留",
  "writeFolder": "D:\\folder_name",
  "proxyObject": {
    "protocol": "http",
    "host": "127.0.0.1",
    "port": 7890
  },
  "proxyString": "http://127.0.0.1:7890"
}
```

## 赞助
https://afdian.net/@SeldonHorizon

如果你觉得休留很萌，可以请管理员喝杯奶茶