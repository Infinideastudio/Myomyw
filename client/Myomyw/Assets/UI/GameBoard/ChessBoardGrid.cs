using System;
using Engine;
using UI.GameBoard.BoardGrid;
using UnityEngine;
using UnityEngine.UI;

namespace UI.GameBoard
{
    public class ChessBoardGrid : MonoBehaviour
    {
        private GameObject[] _chess;

        private void UpdateChessBoard(GameObject canvas)
        {
            var chessBoard = ChessBoard.Current;
            var trans = canvas.GetComponent<RectTransform>();
            trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, chessBoard.SizeLeft * 64 + 64);
            trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, chessBoard.SizeRight * 64 + 64);
            _chess = new GameObject[chessBoard.SizeLeft * chessBoard.SizeRight];
            for (var i = 0; i < chessBoard.SizeLeft; ++i)
            for (var j = 0; j < chessBoard.SizeRight; ++j)
            {
                var obj = _chess[i * chessBoard.SizeLeft + j] = BuildChessRenderer(chessBoard.GetChess(i, j), i, j);
                obj.transform.SetParent(canvas.transform, false);
            }

            for (var i = 0; i < chessBoard.SizeLeft; ++i)
                BuildLauncherButton(i).transform.SetParent(canvas.transform, false);

            for (var i = 0; i < chessBoard.SizeRight; ++i)
                BuildOpponentLauncherButton(i).transform.SetParent(canvas.transform, false);
        }

        private GameObject BuildLauncherButton(int pad)
        {
            var obj = new GameObject();
            obj.SetChessBoardLayout(new Vector3(0, pad + 1, 2));
            var image = obj.AddComponent<Image>();
            image.color = Color.grey;
            image.sprite = null;
            var button = obj.AddComponent<ChessLauncher>();
            button.Setup(pad, this);
            button.targetGraphic = image;
            return obj;
        }

        private static void LaunchChessBegin(int pad)
        {
            throw new NotImplementedException();
        }

        private static GameObject BuildOpponentLauncherButton(int pad)
        {
            var obj = new GameObject();
            obj.SetChessBoardLayout(new Vector3(pad + 1, 0, 2));
            var image = obj.AddComponent<Image>();
            image.color = Color.grey;
            image.sprite = null;
            return obj;
        }

        public void LaunchChess(int pad)
        {
            Debug.Log("Launch Ball");
        }

        private static GameObject BuildChessRenderer(ChessTypeName type, int left, int right)
        {
            var obj = new GameObject();
            obj.SetChessBoardLayout(new Vector3(right + 1, left + 1, 2), new Vector3(0.618f, 0.618f, 1));
            var spriteRenderer = obj.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = Resources.Load<Sprite>(ChessTypeManager.Get(type).Name);
            return obj;
        }

        public void ResetBoard()
        {
            Debug.Log("Begin Updateing");
            new ChessBoard().MakeCurrent();
            UpdateChessBoard(gameObject);
            Debug.Log($"Board Updation {ChessBoard.Current.SizeLeft}, {ChessBoard.Current.SizeRight}");
        }
    }
}