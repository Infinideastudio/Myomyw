package cn.newinfinideas.myomyw

import kotlin.reflect.KClass

enum class PacketBound { Client, Server, Any }

annotation class PacketMeta(val bound: PacketBound, val name: String)

data class LoginPacket(var name: String)

class MatchPacket

data class StartPacket(val side: Int, val room: Int, val opponentName: String)

data class NextChessmanPacket(val chessman: Int) {
    constructor(chessman: Chessman): this(chessman.ordinal)
}

class EndTurnPacket

data class MovePacket(val col: Int?)

data class EndGamePacket(val reason: Int) {
   constructor(reason: EndReason): this(reason.ordinal)
}

object PacketTable {
    private val map = HashMap<KClass<*>, String>()
    private val invMap = HashMap<String, KClass<*>>()

    private fun push(klass: KClass<*>, name: String) {
        map[klass] = name
        invMap[name] = klass
    }

    fun getName(klass: KClass<*>) = map[klass]!!

    fun getClass(name: String) = invMap[name]!!

    init {
        push(LoginPacket::class, "login")
        push(MatchPacket::class, "match")
        push(StartPacket::class, "start")
        push(NextChessmanPacket::class, "nextChessman")
        push(EndTurnPacket::class, "endTurn")
        push(MovePacket::class, "move")
        push(EndGamePacket::class, "endGame")
    }
}