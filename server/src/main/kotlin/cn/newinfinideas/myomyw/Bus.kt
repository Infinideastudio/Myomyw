package cn.newinfinideas.myomyw

import com.google.gson.Gson
import io.ktor.http.cio.websocket.*

class Bus(private val session: WebSocketSession) {
    private val onMsg: HashMap<String, ArrayList<suspend (String) -> Unit>> = HashMap()

    fun on(name: String, reset: Boolean, fn: suspend (String) -> Unit) {
        synchronized(onMsg) {
            onMsg.putIfAbsent(name, ArrayList())
            val q = onMsg[name]
            if (q != null) {
                if (reset) q.clear()
                q.add(fn)
            }
        }
    }

    inline fun <reified T> on(reset: Boolean, crossinline func: suspend (T) -> Unit) {
        this.on(PacketTable.getName(T::class), reset) { func(Gson().fromJson(it, T::class.java)) }
    }

    suspend fun emit(name: String, content: String) = session.outgoing.send(Frame.Text("$name$@@$$content"))

    suspend inline fun <reified T> emit(content: T) = emit(PacketTable.getName(T::class), Gson().toJson(content))

    suspend fun runLoop() {
        for (frame in session.incoming) {
            when (frame) {
                is Frame.Text -> recv(frame.readText())
                is Frame.Close -> handleDisconnect()
                else -> TODO("handle other frames")
            }
        }
        handleDisconnect()
    }

    var disconnected = false

    private suspend fun handleDisconnect() {
        val shallHandle: Boolean
        synchronized(disconnected) {
            shallHandle = !disconnected
            if (!disconnected) disconnected = true
        }
        if (shallHandle) handleFrame("disconnect", "{}")
    }

    private suspend fun recv(content: String) {
        val name = content.substringBefore("$@@$")
        var body = content.substringAfter("$@@$")
        if (body.isEmpty()) body = "{}"
        handleFrame(name, body)
    }

    private suspend fun handleFrame(name: String, body: String) {
        var unit: Array<suspend (String) -> Unit>? = null
        synchronized(onMsg) {
            val q = onMsg[name]
            if (q != null) unit = q.toTypedArray()
        }
        if (unit != null) for (v in unit!!) v(body)
    }

    suspend fun disconnect() = session.close(CloseReason(CloseReason.Codes.NORMAL, ""))
}
