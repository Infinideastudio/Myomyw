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
    private delegate void Operation();

    public class ChessOperation
    {
        public void Process()
        {
            if (OnOperation != null) 
                OnOperation();
            if (_operation != null)
                _operation();
        }

        public delegate void OnOperationEvent();

        private event OnOperationEvent OnOperation;

        private Operation _operation;
    }

    private ChessType[] _chessBoard;

    private int _sizeLeft, _sizeRight;

    private readonly Dictionary<ChessType, Operation> _operations = new Dictionary<ChessType, Operation>();

    public ChessBoard()
    {
        _operations.Add(ChessType.Normal, null);

    }

    private void ProcessExtraChess(ChessType type)
    {
        _operations[type]();
    }

    private ChessType GetChess(int left, int right)
    {
        return _chessBoard[left * _sizeLeft + right];
    }

    private void ResizeBoard(int newSizeLeft, int newSizeRight)
    {
        var board = new ChessType[newSizeLeft * newSizeRight];
        for (var i = 0; i < newSizeLeft; ++i)
        for (var j = 0; j < newSizeRight; ++j)
            board[i * newSizeLeft + j] = GetChess(i, j);
        _chessBoard = board;
        _sizeLeft = newSizeLeft;
        _sizeRight = newSizeRight;
    }
    
}