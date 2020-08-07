package cn.newinfinideas.myomyw

import com.google.gson.GsonBuilder

class Player(private val socket: Bus, val name: String, private val id: Int) {
    val builder = GsonBuilder()

    inline fun <reified T> onPacket(crossinline func: suspend (T) -> Unit) {
        this.on(PacketTable.getName(T::class)) { func(builder.create().fromJson(it, T::class.java)) }
    }

    fun on(event: String, func: suspend (String) -> Unit) {
        this.socket.on(event, true, func)
    }

    suspend inline fun <reified T> emit(content: T) = emit(PacketTable.getName(T::class), builder.create().toJson(content))

    suspend fun emit(name: String, content: String) = this.socket.emit(name, content)

    suspend fun disconnect() = this.socket.disconnect()

    fun getDescription(): String = "${this.name}(${this.id})"
}