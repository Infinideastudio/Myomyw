# Myomyw协议

Myomyw的数据包采用json格式发送，每个json的具体格式如下

## 注册

#### Request

event为regist

username表示玩家用户名，为一个长度位于3-15的字符串，且不包含特殊字符（不包括_）

email表示用户邮箱

##### example

```json
{
  	"event" : "register",
  	"username" : "null" ,
  	"email" : "root@oier.moe"
}
```

#### Response

event为regist

error_code为错误代码

- 0x00表示注册成功
- 0x41表示用户名不符合要求
- 0x42表示邮箱错误
- 0xff表示UKE

##### example

```json
{
  	"event" : "register",
	"error_code" : 0
}
```





## 登陆

#### Request 
event为login

username表示玩家用户名，为一个长度位于3-15的字符串，且不包含特殊字符（不包括_）

password表示用户密码散列值

version表示用户当前版本号

##### example 
```json
{
	"event" : "login",
	"username" : "null" ,
	"version" : "0.7"
}
```

#### Response

event为log_in

error_code表示服务器返回的错误代码

- 0x00为登陆成功
- 0x01为用户名或密码错误
- 0x02为服务器正忙
- 0x03为版本不匹配
- 0xff表示UKE

如果error_code=0x00，返回uuid表示用户的唯一身份(uuid4)

如果error_code=0x00，返回rooms数组，类型为列表

- 列表中num表示房间编号
- waited表示是否处于等待状态
- player1表示第一玩家名字（player1为先手）
- 如果waited=false，则有player2表示第二玩家名字
- locked表示房间是否加锁（即需要密码）

返回rating表示当前用户等级分

返回rank数组，为一列表表示排名前十的用户
- user_name为用户名字
- rating为等级分

##### example
```json
{
  	"event" : "log_in",
	"error_code" : 0x00 ,
	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"rating" : 2333
  	"rooms" : [
   	{
    	"waited" : true,
      	"player1" :"ob",
      	"watched_num" : 5
  	}
  	]
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
event为enter

uuid参数表示Server返回的uuid

watched参数表示是否旁观

new_room参数表示用户是否新建房间（true表示新建）

如果new_room=false，room_id参数表示用户选择的房间（为已有房间,或者room_id=0表示随机进房）

如果房间locked=true则需提供password表示密码

##### example
```json
{
	"event" : "enter",
	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
	"watched" ： "false",
  	"new_room" : "true",
	"room_id" : 233
}
```
##### Response

event为enter

error_code表示服务器返回的错误代码

- 0x00表示成功连接
- 0x11表示房间人已满
- 0x12表示无法创建更多的房间
- 0x13表示密码错误或没有提供密码
- 0xff表示UKE

##### example

```json
{
  	"event" : "enter",
 	"error_code" : 0x00
}
```

---

## 开始游戏

#### Request (Server发送)
event为start

opponent_name表示对手名字

overtime表示超时时间（以ms为单位）

is_first表示玩家是否为先手

##### example

```json
{
	"event" : "start",
  	"opponent_name" : "qzr",
  	"overtime" : 20000,
  	"is_first" : "true"
}
```

#### Response(Client发送)

event为ready

uuid表示用户的uuid

ready=true表示已收到

##### example

```json
{
  	"event" : "ready",
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"ready" : "true"
}
```

#### Response(Server发送)

event为ready

error_code表示错误代码

- 0x00表示正常开始游戏

- 0x21表示对方在一定时间内未发送ready

- 0xff表示UKE

##### example

```json
{
    "event" : "ready",
    "error_code" : 0x00
}
```


---

## 游戏过程中

#### Request
event为gaming

uuid表示用户的uuid

col表示用户操作的行号

##### example

```json
{
	"event" : "gaming", 
 	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"col" : 5
}
```

#### Response（同时对两个Client发送）

event为gaming

ended表示游戏是否结束

- 0x00表示游戏未结束

- 0x31表示对方超时

- 0x32表示自己超时

- 0x33表示自己赢得比赛

- 0x34表示自己输掉比赛

- 0xff表示服务器发生错误

返回succeed表示操作是否成功

返回col表示移动行号(一开始col为0)

返回next_ball表示下一个球的类型

##### example

```json
{
    "event" : "gaming",
  	"ended" : 0x00,
    "succeed" :"true",
    "col" : 5,
    "next_ball" : 1
}
```

  ​

#### Response(双方Client)

event为received

uuid表示用户的uuid

返回received=true表示接收到参数

##### example

```json
{
  	"event" : "received", 
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"received" : "true"
}
```



## 聊天

#### Request

event为chat

uuid为用户的uuid

text为用户聊天内容

##### example

```json
{
  	"event" : "chat",
  	"uuid" : "651a4613-ad1c-405d-a255-df89dcd3a59c" ,
  	"text" : "qzrakioi2019"
}
```



#### Response（对房间内所有人广播）

event为chat

user_name为讲话用户名字

text为用户聊天内容

##### example

```json
{
  	"event" : "chat",
  	"user_name" : "null",
  	"text" : "qzrakioi2019"
}
```



