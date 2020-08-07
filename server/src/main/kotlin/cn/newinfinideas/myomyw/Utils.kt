package cn.newinfinideas.myomyw

import kotlinx.coroutines.*

class Timeout(private val timeMs: Long, private val fn: suspend ()->Unit) {
    private var cancelled = false

    init { start() }

    fun cancel() = synchronized(this) { cancelled = true }

    private fun start() {
        GlobalScope.launch {
            delay(timeMs)
            val test: Boolean
            synchronized(this) { test = cancelled }
            if (!test) fn()
        }
    }
}
