# Myomyw 数据库服务器协议

所有request和response均使用HTTP。所有request都需要附上token字段。

## 添加用户

Method: POST
Route: /add_user

### Request
|   参数名    |   描述    |   类型   |
| :------: | :-----: | :----: |
|   uuid   | 用户的uuid | string |
| username |  用户名字   | string |

### Response

| error_code |   描述   |
| :--------: | :----: |
|    0x00    |   成功   |
|    0x31    | 用户名已使用 |
|    0xff    |  UKE   |

---

## 获取玩家信息

Method: GET/POST
Route: /get_user

### Request 

| 参数名  |   描述   |   类型   |
| :--: | :----: | :----: |
| uuid | 玩家UUID | string |

### Response

|   参数名    |  描述   |   类型   |
| :------: | :---: | :----: |
| username | 用户名字  | string |
|  rating  | 用户等级分 |  int   |
|  ranking  | 用户排名 |  int   |
|  error_code  | 错误码 |  int   |

| error_code |  描述  |
| :--------: | :--: |
|    0x00    |  成功  |
|    0x01    | 查无此人 |

#### Example
```json
{
	"error_code": 0,
	"username" :"ranwen",
  	"rating" : 2333,
  	"ranking" : 1
}
```

---

## 回合结果上报

Method: POST
Route: /round_over

### Request

|  参数名  |            描述             |   类型   |
| :---: | :-----------------------: | :----: |
| winner |         胜者的uuid         | string |
| loser |          输者的uuid         | string |

### Response

| error_code | 描述    |
| ---------- | ----- |
| 0x00       | 成功  |
| 0xff       | 失败  |

---

## 绑定邮箱

Method: POST
Route: /bind_email

### request

|  参数名  |  描述   |   类型   |
| :---: | :---: | :----: |
| uuid  | uuid  | string |
| email | email | string |

### Response

| error_code |  描述  |
| :--------: | :--: |
|    0x00    | 成功 |
|    0xff    | 失败 |

---

## 找回UUID

Method: POST
Route: /restore

会向邮箱绑定的账号（如果有）发送一封邮件，包含恢复UUID用的链接。

### Request

|  参数名  |  描述  |   类型   |
| :---: | :--: | :----: |
| email | 邮箱地址 | string |

### Response

| error_code |  描述  |
| :--------: | :--: |
|    0x00    | 成功 |
|    0x01    | 账号不存在 |
|    0xff    | 失败  |

---

## 删除用户

Method: POST
Route: /delete

### Request

| 参数名  |   描述    |   类型   |
| :--: | :-----: | :----: |
| uuid | 用户的uuid | string |

### Response

| error_code |  描述  |
| :--------: | :--: |
|    0x00    |  成功  |
|    0xff    | 失败  |