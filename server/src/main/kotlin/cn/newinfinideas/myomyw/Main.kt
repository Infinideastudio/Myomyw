package cn.newinfinideas.myomyw

import io.ktor.application.Application
import io.ktor.application.call
import io.ktor.application.install
import io.ktor.features.CORS
import io.ktor.features.CachingHeaders
import io.ktor.features.CallLogging
import io.ktor.features.DefaultHeaders
import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.content.CachingOptions
import io.ktor.response.respondText
import io.ktor.routing.Routing
import io.ktor.routing.get
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.websocket.WebSockets
import io.ktor.websocket.webSocket

var userId: Int = 0

fun Application.module() {
    install(DefaultHeaders)
    install(CORS)
    {
        method(HttpMethod.Options)
        header(HttpHeaders.XForwardedProto)
        host(Config.allowOrigin)
        allowCredentials = true
        allowNonSimpleContentTypes = true
    }
    install(CachingHeaders) {
        options { CachingOptions(CacheControl.NoCache(CacheControl.Visibility.Public)) }
    }
    install(CallLogging)
    install(WebSockets)
    appRouting()
}

private fun Application.appRouting() {
    install(Routing) {
        get("/is-server") {
            call.respondText("{\"version\": \"${Config.version}\"}", ContentType.Text.Html)
        }
        webSocket("/") {
            val bus = Bus(this)
            var player: Player?
            bus.on<LoginPacket>(false) {
                synchronized(userId) {
                    player = Player(bus, it.name, userId++)
                    player!!.onPacket<MatchPacket> { RoomHost.startMatch(player!!) }
                    player!!.on("disconnect") { RoomHost.cancelMatch(player!!) }
                }
            }
            bus.runLoop()
        }
    }
}

fun main() {
    embeddedServer(Netty, Config.port, module = Application::module).start(wait = true)
}
