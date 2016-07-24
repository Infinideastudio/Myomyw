# Myomyw
**基于Cocos2d-js的全新的Myomyw！**
## 概述
Myomyw是一款半棋牌游戏。不同于其他对战游戏的是，你的操作决定的是对方的胜负，因此你需要思考如何迫使对方让自己赢，这也是Myomyw这个名字的由来：Make your opponent make you win。
## 游戏规则
游戏界面中左上和右上有两排发射器，中间是棋盘，轮到你时你可以点击或你的一个发射器，把对应列的球推出去，按住发射器可以连续发射球，但最多只能发射五次。

发射器发射出的球有7/10的几率是普通球（黑色），1/10的几率是决胜球（红色），1/10是增列球（绿色带加号），1/10是减列球（黄色带减号），1/10是翻转球（蓝色带曲箭头）。

* 如果一方把决胜球推出棋盘，那么对方胜利。
* 如果一方把增列球推出棋盘，那么推出球的那一边就会增加一列(最多10列)。
* 如果一方把减列球推出棋盘，那么推出球的那一边就会减少一列(最少3列)。
* 如果一方把翻转球推出棋盘，那么棋盘就会左右翻转，需要注意翻转后会立刻转入对手回合。

顶部的一个格子是计时器，超时后对方胜利。（在联机对战中始终存在，在单机双人、人机对战中可进行设置。）

目前有单机双人、人机对战和联机对战三个模式。
## 配置
### 客户端
1. 首先在[这里](http://www.cocos2d-x.org/filedown/cocos2d-x-3.12.zip)下载Cocos2d-x 3.12。
2. 使用引擎目录下的`setup.py`进行配置安装。（使用Python2.x运行。）如果你要编译到Android上，你需要配置NDK，Android SDK和Ant；如果你要发布Web的Release版，你需要配置Ant；否则你可以跳过这几项的配置。
3. 在Repo目录下执行`cocos new Myomyw -l js`。
4. 完成后Repo目录下会多出一个名为`Myomyw`的目录。把这个目录里的`frameworks`文件夹移动到Repo目录下的`client`中。
5. 删除`Myomyw`目录即可。
### 服务端
确保你安装了node.js和npm后，在`server`目录下运行`npm install`安装依赖模块。

建议使用VS插件NTVS以方便调试（已对`.gitignore`进行相应设置）。
## 运行
### Web
#### Debug
在`server`目录下使用脚本或运行`node src/server.js`启动服务器，然后用浏览器打开相应的地址。
#### Release
在`client`目录下运行`cocos compile -p web -m release`，即可在`client/publish/html5`下生成打包后的Web发布包。修改服务端的`config.js`中的`clientPath`为`../client/publish/html5`，然后在`server`目录下使用脚本或运行`node src/server.js`启动服务器，用浏览器打开相应的地址。
### 原生平台
使用cocos2d-console或该平台的编译工具编译`client/frameworks/runtime-src`下的对应项目。
## 协议
The MIT License