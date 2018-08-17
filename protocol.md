# Myomyw协议

Myomyw的数据包采用json格式发送，每个json的具体格式如下
## 注意：文中所有十六进制在实际传输中请用十进制

## 注册

#### Request
|   参数名    |          描述           |   类型   |  可选  |
| :------: | :-------------------: | :----: | :--: |
|  action   |       register        | string |      |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |      |
|  email   |         用户邮箱          | string |      |

##### example

```json
{
  	"action" : "register",
  	"username" : "null" ,
  	"email" : "root@oier.moe"
}
```

#### Response
|    参数名     |    描述    |   类型   |  可选  |
| :--------: | :------: | :----: | :--: |
|   action    | register | string |      |
| error_code |   错误代码   |  int   |      |

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
	"error_code" : 0
}
```





## 登陆

#### Request 
|   参数名    |          描述           |   类型   |  可选  |
| :------: | :-------------------: | :----: | :--: |
|  action   |         login         | string |      |
| uuid | 玩家UUID，若不填则视为新用户 | string |  是 |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |      |
| version  |        用户当前版本号        | string |      |

##### example 
```json
{
	"action" : "login",
	"username" : "null" ,
	"version" : "1.0"
}
```

#### Response
|    参数名     |       描述       |   类型   |  可选  |
| :--------: | :------------: | :----: | :--: |
|   action    |     login      | string |      |
| error_code |   服务器返回的错误代码   | int |      |
|    uuid    | 用户的唯一身份(uuid4) | string | yes  |
|   rooms    |       房间       |   Room[]   | yes  |
|   rating   |     用户等级分      |  int   | yes  |
|    rank    |    排名前十的用户     |   Rank[]   | yes  |

| error_code |    描述    |
| :--------: | :------: |
|    0x00    |   登陆成功   |
|    0x01    | 用户名或密码错误 |
|    0x02    |  服务器正忙   |
|    0x03    |  版本不匹配   |
|    0xff    |   UKE    |

|  Room  |          描述          |   类型   |  可选  |
| :-----: | :------------------: | :----: | :--: |
|   id   |         房间编号         |  int   |      |
| waiting  |       是否处于等待状态       |  bool  |      |
| player |  玩家名字  | string[] |      |
| locked  |    房间是否加锁（即需要密码）     |  bool  |      |

|   Rank    |  描述  |   类型   |  可选  |
| :-------: | :--: | :----: | :--: |
| username | 用户名字 | string |      |
|  rating   | 等级分  |  int   |      |

##### example
```json
{
  	"action" : "log_in",
	"error_code" : 0x00 ,
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
|   参数名    |                描述                |   类型   |  可选  |
| :------: | :------------------------------: | :----: | :--: |
|  action   |              enter               | string |      |
|   uuid   |          Server返回的uuid           | string |      |
| watched  |               是否旁观               |  bool  |      |
| new_room |        用户是否新建房间（true表示新建）        |  bool  |      |
| room_id  | 用户选择的房间（为已有房间,或者room_id=0表示随机进房） |  int   | yes  |
| password |                密码                | string | yes  |

##### example
```json
{
	"action" : "enter",
	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
	"watched" : false,
  	"new_room" : true,
	"room_id" : 233
}
```
##### Response

|    参数名     |  描述   |   类型   |  可选  |
| :--------: | :---: | :----: | :--: |
|   action    | enter | string |      |
| error_code | 错误代码  |  int   |      |

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
 	"error_code" : 0x10
}
```

---

## 开始游戏

#### Request (Server发送)

|      参数名      |      描述      |   类型   |  可选  |
| :-----------: | :----------: | :----: | :--: |
|     action     |    start     | string |      |
| opponent_name |     对手名字     | string |      |
|   overtime    | 超时时间（以ms为单位） |  int   |      |
|   is_first    |   玩家是否为先手    |  bool  |      |

##### example

```json
{
	"action" : "start",
  	"opponent_name" : "qzr",
  	"overtime" : 20000,
  	"is_first" : true
}
```

#### Response(Client发送)
|  参数名  |    描述     |   类型   |  可选  |
| :---: | :-------: | :----: | :--: |
| action |   ready   | string |      |
| uuid  |  用户的uuid  | string |      |
| ready | true表示已收到 |  bool  |      |

##### example

```json
{
  	"action" : "ready",
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"ready" : true
}
```

#### Response(Server发送)

|    参数名     |  描述   |   类型   |  可选  |
| :--------: | :---: | :----: | :--: |
|   action    | ready | string |      |
| error_code | 错误代码  |  int   |      |

| error_code |        描述        |
| :--------: | :--------------: |
|    0x00    |      正常开始游戏      |
|    0x21    | 对方在一定时间内未发送ready |
|    0xff    |       UKE        |

##### example

```json
{
    "action" : "ready",
    "error_code" : 0x20
}
```

---

## 游戏过程中

#### Request
|  参数名  |   描述    |   类型   |  可选  |
| :---: | :-----: | :----: | :--: |
| action | gaming  | string |      |
| uuid  | 用户的uuid | string |      |
|  col  | 用户操作的行号 |  int   |      |

##### example

```json
{
	"action" : "gaming", 
 	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"col" : 5
}
```

#### Response（同时对两个Client发送）

|    参数名    |              描述              |   类型   |  可选  |
| :-------: | :--------------------------: | :----: | :--: |
|   action   |            gaming            | string |      |
|   ended   |            游戏是否结束            |  int   |      |
|  succeed  |            操作是否成功            |  bool  | yes  |
|    col    |        移动行号(一开始col为0)        |  int   | yes  |
| next_ball | 下一个球的类型(1:N,2:=,3:-,4:R,5:V) |  int   | yes  |

| ended |   描述    |
| :---: | :-----: |
| 0x00  |  游戏未结束  |
| 0x31  |  对方超时   |
| 0x32  |  自己超时   |
| 0x33  | 自己赢得比赛  |
| 0x34  | 自己输掉比赛  |
| 0xff  | 服务器发生错误 |

##### example

```json
{
    "action" : "gaming",
  	"ended" : 0x00,
    "succeed" :true,
    "col" : 5,
    "next_ball" : 1
}
```

  ​

#### Response(双方Client)

|   参数名    |     描述      |   类型   |  可选  |
| :------: | :---------: | :----: | :--: |
|  action   |  received   | string |      |
|   uuid   |   用户的uuid   | string |      |
| received | true表示接收到参数 |  bool  |      |

##### example

```json
{
  	"action" : "received", 
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"received" : true
}
```



## 聊天

#### Request

|  参数名  |   描述    |   类型   |  可选  |
| :---: | :-----: | :----: | :--: |
| action |  chat   | string |      |
| uuid  | 用户的uuid | string |      |
| text  | 用户聊天内容  | string |      |

##### example

```json
{
  	"action" : "chat",
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"text" : "qzrakioi2019"
}
```



#### Response（对房间内所有人广播）
|    参数名    |   描述   |   类型   |  可选  |
| :-------: | :----: | :----: | :--: |
|   action   |  chat  | string |      |
| user_name | 讲话用户名字 | string |      |
|   text    | 用户聊天内容 | string |      |

##### example

```json
{
  	"action" : "chat",
  	"user_name" : "null",
  	"text" : "qzrakioi2019"
}
```



