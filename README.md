# chat-xiuliu

虚拟主播休留的双向语音单机版
[Bilibili 直播间](https://live.bilibili.com/27228804)

<img src="https://raw.githubusercontent.com/SchneeHertz/chat-xiuliu/master/public/chat-xiuliu.png" alt="chat-xiuliu.png" width="256"/>

## 功能
- 从麦克风或界面接收问题
- 使用语音回答问题并显示在界面

## 使用说明
1. 下载并安装sox https://sourceforge.net/projects/sox/files/sox/14.4.1/
2. 将sox所在文件夹添加到环境变量Path中
3. 下载sox MP3组件 https://www.videohelp.com/software?d=sox-14.4.0-libmad-libmp3lame.zip
4. 将libmp3lame.dll放入sox所在文件夹
5. 打开chat-xiuliu, 点击Open Config, 编辑配置文件
5. 获取一个openai的API key, 填入配置文件中
6. 安装Python，然后安装edge-tts `pip install edge-tts`
7. 修改配置文件的其他部分（可选）
8. 保存配置文件后重启chat-xiuliu

### 配置文件参考
```
{
  "OPENAI_API_KEY": "sk-",
  "USE_MODEL": "gpt-3.5-turbo",
  "SpeechSynthesisVoiceName": "zh-CN-XiaoyiNeural",
  "ADMIN_NAME": "Chell",
  "AI_NAME": "休留",
  "systemPrompt": "你是女高中生休留",
  "proxy": {
    "type": "http",
    "host": "127.0.0.1",
    "port": 7890
  }
}
```


## 其他
关注休留喵，关注休留谢谢喵~
上舰或者[爱发电](https://afdian.net/a/xiuliu)捐赠等额可进舰长群727536542, 管理员提供附加的有限的技术支持