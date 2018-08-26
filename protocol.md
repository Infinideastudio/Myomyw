# Myomyw协议v2.0

Myomyw的数据包采用json格式发送，每个json的具体格式如下，每次传输分成header与body两个部分

## header部分

| 参数名        | 描述                    | 类型     |
| ---------- | --------------------- | ------ |
| action     | 表示数据包的类型              | string |
| ref        | session id（任何int，会被原样返回）| int    |
| error_code | 错误代码（错误码对照表位于body描述中） | int    |


## body部分

---

### 注册

#### Request

action为register

|   参数名    |          描述           |   类型   |
| :------: | :-------------------: | :----: |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |
|  email   |         用户邮箱          | string |


#### Response

action为register

| error_code |    描述    |
| :--------: | :------: |
|    0x00    |   成功   |
|    -    | 用户名不符合要求 |
|    -    |   邮箱错误   |
|    0xff    |   UKE    |

---

### 登陆

#### Request 

action为login

|   参数名    |          描述           |   类型   |
| :------: | :-------------------: | :----: |
|   uuid   |   玩家UUID，若不填则视为新用户    | string |
| username | 玩家用户名，为一个长度位于3-15的字符串 | string |
| version  |        用户当前版本号        | string |


#### Response

action为login

|  参数名   |       描述       |   类型   |
| :----: | :------------: | :----: |
|  uuid  | 用户的唯一身份(uuid4) | string |
| rooms  |       房间       | Room[] |
| rating |     用户等级分      |  int   |
|  rank  |    排名前十的用户     | Rank[] |

|  Room   |      描述       |    类型    |
| :-----: | :-----------: | :------: |
|   id    |     房间编号      |   int    |
| waiting |   是否处于等待状态    |   bool   |
| locked  | 房间是否加锁（即需要密码） |   bool   |

|   Rank   |  描述  |   类型   |
| :------: | :--: | :----: |
| username | 用户名字 | string |
|  rating  | 等级分  |  int   |

#### Error

| error_code |    描述    |
| :--------: | :------: |
|    0    |   成功   |
|    1    |  版本不匹配   |
|    0xff    |   UKE    |

---

### 进入房间

#### Request

action为join_room

|   参数名    |                描述                |   类型   |
| :------: | :------------------------------: | :----: |
| watching  |               是否旁观               |  bool  |
| roomid  | 用户选择的房间（为已有房间,或者room_id=-1表示随机进房） |  int   |
| password |                密码                | string |

#### Error

| error_code |     描述      |
| :--------: | :---------: |
|    0    |    成功     |
|    2    |    房间人已满    |
|    3    |  房间不存在  |
|    4    | 密码错误或没有提供密码 |
|    5    |    已在房间内    |
|    6    |    未登录    |
|    0xff    |     UKE     |

---

### 建立房间

#### Request

action为create_room

|   参数名    |                描述                |   类型   |
| :------: | :------------------------------: | :----: |
| watching  |               是否旁观               |  bool  |
| password |                密码（留空为无密码）           | string |

#### Error

| error_code |     描述      |
| :--------: | :---------: |
|    0    |    成功     |
|    5    |    已在房间内    |
|    6    |    未登录    |
|    0xff    |     UKE     |

---

### 开始游戏

#### Request (Server广播)

action为start_game

|      参数名      |      描述      |   类型   |
| :-----------: | :----------: | :----: |
| player_names |     双方的名称     | string |
|   overtime    | 超时时间（以ms为单位） |  int   |
|   first_id    |   先手玩家名称序号    |  int  |


#### Response (Client发送)

action为ready // 实际服务端并没有检测，发不发无所谓

---

### 游戏过程

#### Request

action为move

| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| num  | 用户操作的行号/列号 |  int   |
| handover  | 是否回合结束 |  bool   |

#### Response（广播）

action为game_update

|    参数名    |              描述              |  类型  |
| :-------: | :--------------------------: | :--: |
|    col    |        是否是列(false为行)        | bool  |
|    num    |        移动行/列号        | int  |
| next_ball | 下一个球的类型           | int  |
| handover  | 是否回合结束 |  bool   |

#### Error

| error_code |     描述      |
| :--------: | :---------: |
|    0    |    成功     |
|    6    |    未登录    |
|    7    |    不在游戏内    |
|    8    |    无权移动（不在你的回合内）    |
|    9    |    游戏结束    |
|    0xff    |     UKE     |

---

### 聊天

#### Request

action为send_chat

| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| message | 用户聊天内容  | string |


#### Error

| error_code |     描述      |
| :--------: | :---------: |
|    0    |    成功     |
|    6    |    未登录    |
|    7    |    不在游戏内    |
|    0xff    |     UKE     |

#### Response（广播）

action为chat

|    参数名    |   描述   |   类型   |
| :-------: | :----: | :----: |
| username | 讲话用户名字 | string |
|   text    | 用户聊天内容 | string |

