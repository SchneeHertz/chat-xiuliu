# chat-xiuliu

ChatGPT双向语音助手

这个项目是由虚拟猫娘休留(直播搞不下去了)的后台fork来的，去掉了弹幕互动的部分，增加了语音输入
截止到2023年8月15日，使用LLM模拟人格的尝试，在我这里没有看到效果及成本可以接受的希望。
所以模拟人格先放下一段时间，再看看未来LLM的发展吧

## 功能
- 从麦克风或界面接收问题
- 使用语音回答问题并显示在界面
- 对话内容回忆
- 联网搜索关键词
- 猫娘发言风格

## 使用说明
- 解压后打开chat-xiuliu.exe, 点击Open Config, 编辑配置文件
- 获取一个openai的API key, 填入配置文件中
- 修改配置文件的其他部分（可选）
- 安装Python，然后安装edge-tts `pip install edge-tts`
- 下载[whisper-standalone-win](https://github.com/Purfview/whisper-standalone-win)r145.3(最好有张N卡，不然运行时很慢)
  - 在whisper-standalone-win的Release和[huggingface](https://huggingface.co/guillaumekln)下载必要的文件，解压到resources/extraResources文件夹
  ```
  resources/extraResources/_models/faster-whisper-large-v2/config.json
  resources/extraResources/_models/faster-whisper-large-v2/model.bin
  resources/extraResources/_models/faster-whisper-large-v2/tokenizer.json
  resources/extraResources/_models/faster-whisper-large-v2/vocabulary.txt
  resources/extraResources/cublas64_11.dll
  resources/extraResources/cublasLt64_11.dll
  resources/extraResources/cudnn_cnn_infer64_8.dll
  resources/extraResources/cudnn_ops_infer64_8.dll
  resources/extraResources/whisper-faster.exe
  resources/extraResources/zlibwapi.dll
  ```
- 保存配置文件后重启chat-xiuliu.exe
- 点击Speech Off切换录音开关，前提是你有可以正常工作的麦克风
- 语音以AI的称呼开头，如: “休留，查询今日夏威夷的气温”

### 配置文件参考
```
{
  "OPENAI_API_KEY": "sk-",
  "DEFAULT_MODEL": "gpt-3.5-turbo-16k",
  "SpeechSynthesisVoiceName": "zh-CN-XiaoyiNeural",
  "ADMIN_NAME": "Chell",
  "AI_NAME": "休留",
  "systemPrompt": "你是虚拟猫娘休留",
  "proxyObject": {
    "type": "http",
    "host": "127.0.0.1",
    "port": 7890
  },
  "proxyString": "http://127.0.0.1:7890"
}
```

## 赞助
https://afdian.net/@SeldonHorizon
如果你觉得休留很萌，可以请管理员喝杯奶茶