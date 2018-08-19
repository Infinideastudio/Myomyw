# Myomyw协议v2.0

Myomyw的数据包采用json格式发送，每个json的具体格式如下，每次传输分成header与body两个部分
## 注意：文中所有十六进制在实际传输中请用十进制

## header部分

| 参数名        | 描述                    | 类型     |
| ---------- | --------------------- | ------ |
| action     | 表示数据包的类型              | string |
| ref        | session id            | int    |
| error_code | 错误代码（错误码对照表位于body描述中） | int    |



## body部分

## 注册

#### Request
action为register
|   参数名    |          描述           |   类型   |
| :------: | :-------------------: | :----: |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |
|  email   |         用户邮箱          | string |

##### example

```json
{
  	"action" : "register",
  	"ref" : "233",
  	"error_code" : 0x00
}
{
  	"username" : "null" ,
  	"email" : "root@oier.moe"
}
```

#### Response

action为register

| error_code |    描述    |
| :--------: | :------: |
|    0x00    |   注册成功   |
|    0x41    | 用户名不符合要求 |
|    0x42    |   邮箱错误   |
|    0xff    |   UKE    |

##### example

```json
{
  	"action" : "register",
  	"ref" : 233,
	"error_code" : 0x00
}
```





## 登陆

#### Request 

action为login

|   参数名    |          描述           |   类型   |
| :------: | :-------------------: | :----: |
|   uuid   |   玩家UUID，若不填则视为新用户    | string |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |
| version  |        用户当前版本号        | string |

##### example 
```json
{
  	"action" : "login",
  	"ref" : "233",
  	"error_code" : 0x00
}
{
	"uuid" : "",
	"username" : "null" ,
	"version" : "1.0"
}
```

#### Response

action为login

|  参数名   |       描述       |   类型   |
| :----: | :------------: | :----: |
|  uuid  | 用户的唯一身份(uuid4) | string |
| rooms  |       房间       | Room[] |
| rating |     用户等级分      |  int   |
|  rank  |    排名前十的用户     | Rank[] |

| error_code |    描述    |
| :--------: | :------: |
|    0x00    |   登陆成功   |
|    0x01    | 用户名或密码错误 |
|    0x02    |  服务器正忙   |
|    0x03    |  版本不匹配   |
|    0xff    |   UKE    |

|  Room   |      描述       |    类型    |  可选  |
| :-----: | :-----------: | :------: | :--: |
|   id    |     房间编号      |   int    |      |
| waiting |   是否处于等待状态    |   bool   |      |
| player  |     玩家名字      | string[] |      |
| locked  | 房间是否加锁（即需要密码） |   bool   |      |

|   Rank   |  描述  |   类型   |  可选  |
| :------: | :--: | :----: | :--: |
| username | 用户名字 | string |      |
|  rating  | 等级分  |  int   |      |

##### example
```json
{
	"action" : "login" ,
    "ref" : 233,
    "error_code" : 0x00
}
{
	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"rating" : 2333,
  	"rooms" : [
   	{
    	"waited" : true,
      	"player1" :"ob",
      	"watched_num" : 5
  	}
  	],
  	"rank" : [
      	{
       		"user_name" : "qzr",
       		"rating" : 3000
      	},
      	{
       		"user_name" : "null",
       		"rating" : 2999
      	}
  	]
}
```

---

## 进入房间

#### Request

action为enter

|   参数名    |                描述                |   类型   |
| :------: | :------------------------------: | :----: |
|   uuid   |          Server返回的uuid           | string |
| watched  |               是否旁观               |  bool  |
| new_room |        用户是否新建房间（true表示新建）        |  bool  |
| room_id  | 用户选择的房间（为已有房间,或者room_id=0表示随机进房） |  int   |
| password |                密码                | string |

##### example
```json
{
  	"action" :"enter",
  	"ref" :233,
  	"error_code" :0x00
}
{
	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
	"watched" : false,
  	"new_room" : true,
	"room_id" : 233
}
```
##### Response

action为enter

| error_code |     描述      |
| :--------: | :---------: |
|    0x00    |    成功连接     |
|    0x11    |    房间人已满    |
|    0x12    |  无法创建更多的房间  |
|    0x13    | 密码错误或没有提供密码 |
|    0xff    |     UKE     |

##### example

```json
{
  	"action" : "enter",
  	"ref" : 233,
 	"error_code" : 0x10
}
```

---

## 开始游戏

#### Request (Server发送)

action为start

|      参数名      |      描述      |   类型   |
| :-----------: | :----------: | :----: |
| opponent_name |     对手名字     | string |
|   overtime    | 超时时间（以ms为单位） |  int   |
|   is_first    |   玩家是否为先手    |  bool  |

##### example

```json
{
 	"action" : "start",
    "ref" : 233,
    "error_code" : 0x00
}
{
  	"opponent_name" : "qzr",
  	"overtime" : 20000,
  	"is_first" : true
}
```

#### Response(Client发送)

action为ready

| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| uuid | 用户的uuid | string |

##### example

```json
{
  	"action" : "ready",
  	"ref" : 233,
  	"error_code" : 0x00
}
{
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
}
```

#### Response(Server发送)

action为ready

| error_code |        描述        |
| :--------: | :--------------: |
|    0x00    |      正常开始游戏      |
|    0x21    | 对方在一定时间内未发送ready |
|    0xff    |       UKE        |

##### example

```json
{
    "action" : "ready",
    "ref" : 233,
    "error_code" : 0x00
}
```

---

## 游戏过程中

#### Request

action为gaming

| 参数名  |   描述    |   类型   |  可选  |
| :--: | :-----: | :----: | :--: |
| uuid | 用户的uuid | string |      |
| col  | 用户操作的行号 |  int   |      |

##### example

```json
{
	"action" : "gaming",
    "ref" : 233,
    "error_code" : 0x00
}
{
 	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"col" : 5
}
```

#### Response（同时对两个Client发送）

action为gaming

|    参数名    |              描述              |  类型  |
| :-------: | :--------------------------: | :--: |
|    col    |        移动行号(一开始col为0)        | int  |
| next_ball | 下一个球的类型(1:N,2:=,3:-,4:R,5:V) | int  |

| error_code |   描述    |
| :--------: | :-----: |
|    0x00    |  游戏未结束  |
|    0x31    |  对方超时   |
|    0x32    |  自己超时   |
|    0x33    | 自己赢得比赛  |
|    0x34    | 自己输掉比赛  |
|    0x35    |  无法移动   |
|    0xff    | 服务器发生错误 |

##### example

```json
{
  	"action" : "gaming",
  	"ref" : 233,
  	"error_code" : 0x00
}
{
    "col" : 5,
    "next_ball" : 1
}
```

  ​

#### Response(双方Client)

action为received
| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| uuid | 用户的uuid | string |
##### example

```json
{
  	"action" : "received", 
  	"ref" : 233,
  	"error_code" : 0x00
}
{
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" 
}
```



## 聊天

#### Request

action为chat

| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| uuid | 用户的uuid | string |
| text | 用户聊天内容  | string |

##### example

```json
{
  	"action" : "chat",
  	"ref" : 233,
  	"error_code" : 0x00
}
{
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"text" : "qzrakioi2019"
}
```



#### Response（对房间内所有人广播）

action为chat

|    参数名    |   描述   |   类型   |
| :-------: | :----: | :----: |
| user_name | 讲话用户名字 | string |
|   text    | 用户聊天内容 | string |

##### example

```json
{
  	"action" : "chat",
  	"ref" : 233,
  	"error_code" :0x00
}
{
  	"user_name" : "null",
  	"text" : "qzrakioi2019"
}
```
