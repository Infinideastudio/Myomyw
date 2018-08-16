using UnityEngine;

public class ChessBoardGrid : MonoBehaviour
{
    // Use this for initialization
    private void Start()
    {
    }

    // Update is called once per frame
    private void Update()
    {
        UpdateChessBoard(gameObject);
    }

    private void UpdateChessBoard(GameObject canvas)
    {
        var chessBoard = ChessBoard.Current;
        
    }
}