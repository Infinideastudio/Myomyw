package cn.newinfinideas.myomyw

import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlin.math.floor

enum class EndReason {
    OpponentLeft, YouWin, OpponentWins, YouOutOfTime, OpponentOutOfTime, ServerFull
}

enum class Chessman {
    Common, Key, AddCol, DelCol, Flip
}

const val left = 0
const val right = 1

class Room(
    private val leftPlayer: Player,
    private val rightPlayer: Player,
    private val closeHandler: () -> Unit,
    private val id: Int
) {
    private var lCol = Config.defaultLCol
    private var rCol = Config.defaultRCol
    private var turn = left
    private var nextChessman = Chessman.Common
    private var movingCol: Int? = null
    private var totalMovementTimes = 0
    private var timeOut: Timeout? = null
    private var ended = false
    private var chessmen = ArrayList<ArrayList<Chessman>>()

    init {
        for (i in 0 until Config.maxLCol) {
            this.chessmen.add(ArrayList())
            for (j in 0 until Config.maxRCol) {
                this.chessmen[i].add(Chessman.Common)
            }
        }
        this.setPlayer(this.leftPlayer, left)
        this.setPlayer(this.rightPlayer, right)
    }

    suspend fun start() {
        this.leftPlayer.emit(StartPacket(left, id, rightPlayer.name))
        this.rightPlayer.emit(StartPacket(right, id, leftPlayer.name))
        this.createAndTellNextChessman()
    }

    private fun setPlayer(player: Player, side: Int) {
        player.onPacket<MovePacket> { onMove(side, it) }
        player.onPacket<EndTurnPacket> { onEndTurn(side) }
        player.on("disconnect") { onDisconnect(side) }
    }

    fun currentPlayer() = if (this.turn == left) this.leftPlayer else this.rightPlayer

    fun waitingPlayer() = if (this.turn == left) this.rightPlayer else this.leftPlayer

    //只有每回合的第一次移动才传递col
    private suspend fun onMove(side: Int, data: MovePacket) {
        if (side != this.turn) return
        if (data.col != null && this.movingCol == null) {
            this.movingCol = data.col
        }
        if (this.movingCol != null && this.totalMovementTimes < Config.maxMovementTimes) {
            this.totalMovementTimes++
            this.waitingPlayer().emit(MovePacket(data.col))
            if (this.move(this.movingCol!!, this.nextChessman)) {
                this.currentPlayer().emit(EndGamePacket(EndReason.OpponentWins))
                this.waitingPlayer().emit(EndGamePacket(EndReason.YouWin))
                this.timeOut?.cancel()
                this.close()
            } else {
                this.timeOut?.cancel()
                //此举是为了防止两次移动间间隔时间过长
                this.timeOut = Timeout(Config.timeLimit.toLong()) { timeOut() }
                this.createAndTellNextChessman()
            }
        }
    }

    private suspend fun onEndTurn(side: Int) {
        if (side == this.turn && this.movingCol != null && this.totalMovementTimes <= Config.maxMovementTimes) {
            this.movingCol = null
            this.setTurn(if (this.turn == left) right else left)
            this.currentPlayer().emit(EndTurnPacket())
        }
    }

    private suspend fun onDisconnect(side: Int) {
        if (!this.ended) {
            (if (side == left) this.rightPlayer else this.leftPlayer).emit(EndGamePacket(EndReason.OpponentLeft))
            this.timeOut?.cancel()
            this.close()
        }
    }

    private suspend fun close() {
        if (!this.ended) {
            this.ended = true
            this.leftPlayer.disconnect()
            this.rightPlayer.disconnect()
            this.closeHandler()
        }
    }

    private fun setTurn(turn: Int) {
        this.turn = turn
        this.movingCol = null
        this.totalMovementTimes = 0
        this.timeOut?.cancel()
        this.timeOut = Timeout(Config.timeLimit.toLong()) { timeOut() }
    }

    private suspend fun timeOut() {
        this.currentPlayer().emit(EndGamePacket(EndReason.YouOutOfTime))
        this.waitingPlayer().emit(EndGamePacket(EndReason.OpponentOutOfTime))
        this.close()
    }

    private suspend fun createAndTellNextChessman() {
        this.nextChessman = this.getRandomChessman()
        this.leftPlayer.emit(NextChessmanPacket(nextChessman))
        this.rightPlayer.emit(NextChessmanPacket(nextChessman))
    }

    private fun getRandomChessman(): Chessman {
        return when (floor(Math.random() * 11).toInt()) {
            0 -> Chessman.Key
            1 -> Chessman.AddCol
            2 -> Chessman.DelCol
            3 -> Chessman.Flip
            else -> Chessman.Common
        }
    }

    //返回值为是否已决胜负
    private fun move(col: Int, chessman: Chessman): Boolean {
        val lastChessman: Chessman //暂存最底下的棋子
        if (this.turn == left) {
            lastChessman = this.chessmen[col][this.rCol - 1]
            for (i in this.rCol - 1 downTo 1) this.chessmen[col][i] = this.chessmen[col][i - 1]
            this.chessmen[col][0] = this.nextChessman
        } else {
            lastChessman = this.chessmen[this.lCol - 1][col]
            for (i in this.lCol - 1 downTo 1) this.chessmen[i][col] = this.chessmen[i - 1][col]
            this.chessmen[0][col] = this.nextChessman
        }

        return when (lastChessman) {
            Chessman.Key -> true
            Chessman.AddCol -> {
                if (this.turn == left)
                    this.setBoardSize(this.lCol, this.rCol + 1)
                else
                    this.setBoardSize(this.lCol + 1, this.rCol)
                false
            }
            Chessman.DelCol -> {
                if (this.turn == left)
                    this.setBoardSize(this.lCol, this.rCol - 1)
                else
                    this.setBoardSize(this.lCol - 1, this.rCol)
                false
            }
            Chessman.Flip -> {
                this.flip()
                //这样做到推出翻转球后无法再移动
                this.totalMovementTimes = Config.maxMovementTimes
                false
            }
            else -> false
        }
    }

    private fun setBoardSize(lCol: Int, rCol: Int) {
        if (lCol > Config.maxLCol || lCol < Config.minLCol || rCol > Config.maxRCol || rCol < Config.minRCol) return
        if (this.lCol < lCol) {
            for (l in this.lCol until lCol) for (r in 0 until rCol) this.chessmen[l][r] = Chessman.Common
        }
        if (this.rCol < rCol) {
            for (l in 0 until lCol) for (r in this.rCol until rCol) this.chessmen[l][r] = Chessman.Common
        }
        this.lCol = lCol
        this.rCol = rCol
    }

    private fun flip() {
        for (l in 0 until Config.maxLCol) {
            for (r in l + 1 until Config.maxRCol) {
                val temp = this.chessmen[l][r]
                this.chessmen[l][r] = this.chessmen[r][l]
                this.chessmen[r][l] = temp
            }
        }
        val temp = this.rCol
        this.rCol = this.lCol
        this.lCol = temp
    }
}

object RoomHost {
    var pending: Player? = null
    var id: Int = 0

    fun startMatch(player: Player) = synchronized(this) {
        if (pending == null) pending = player
        else {
            val room = Room(pending!!, player, {}, id++)
            pending = null
            GlobalScope.launch { room.start() }
        }
    }

    fun cancelMatch(player: Player) = synchronized(this) { if (pending == player) pending = null }
}