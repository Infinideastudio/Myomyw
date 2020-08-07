package cn.newinfinideas.myomyw

object Config {
    val port = 8650
    val allowOrigin = "*"
    val maxRooms = 100
    val version = "0.7"

    val defaultLCol = 6
    val defaultRCol = 6
    val maxLCol = 10
    val maxRCol = 10
    val minLCol = 3
    val minRCol = 3
    val maxMovementTimes = 5
    val timeLimit = 20000//超时时间
    val maxInterval = 5000//两次移动之间的最大间隔
}