using System.Collections.Generic;

public enum ChessType
{
    Normal = 0,
    Kill,
    Transpose,
    AddRow,
    KillRow
}

public class ChessBoard
{
    private readonly Dictionary<ChessType, Operation> _operations = new Dictionary<ChessType, Operation>();

    private ChessType[] _chessBoard;

    public ChessBoard()
    {
        _operations.Add(ChessType.Normal, null);
    }
    
    public static ChessBoard Current { get; private set; }

    public int SizeLeft { get; private set; }

    public int SizeRight { get; private set; }

    public void MakeCurrent() => Current = this;
    
    private void ProcessExtraChess(ChessType type)
    {
        _operations[type]();
    }

    private ChessType GetChess(int left, int right)
    {
        return _chessBoard[left * SizeLeft + right];
    }

    private void ResizeBoard(int newSizeLeft, int newSizeRight)
    {
        var board = new ChessType[newSizeLeft * newSizeRight];
        for (var i = 0; i < newSizeLeft; ++i)
        for (var j = 0; j < newSizeRight; ++j)
            board[i * newSizeLeft + j] = GetChess(i, j);
        _chessBoard = board;
        SizeLeft = newSizeLeft;
        SizeRight = newSizeRight;
    }

    private delegate void Operation();

    public class ChessOperation
    {
        public delegate void OnOperationEvent();

        private Operation _operation;

        public void Process()
        {
            OnOperation?.Invoke();
            _operation?.Invoke();
        }

        private event OnOperationEvent OnOperation;
    }
}