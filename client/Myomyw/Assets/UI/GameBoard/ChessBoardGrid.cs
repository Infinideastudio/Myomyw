using Assets.GameEngine;
using UnityEngine;
using UnityEngine.UI;

public class ChessBoardGrid : MonoBehaviour {
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

	private static GameObject BuildLauncherButton(int pad)
	{
		var obj = new GameObject();
		ApplyBoardCellLayout(obj);
		obj.transform.localPosition = new Vector3(32, - pad * 64 - 32 - 64, -2);
		var image = obj.AddComponent<Image>();
		image.color = Color.grey;
		image.sprite = null;
		var button = obj.AddComponent<Button>();
		button.targetGraphic = image;
		button.onClick.AddListener(() => LaunchChess(pad));
		return obj;
	}

	private static GameObject BuildOpponentLauncherButton(int pad)
	{
		var obj = new GameObject();
		ApplyBoardCellLayout(obj);
		obj.transform.localPosition = new Vector3(pad * 64 + 32 + 64, - 32, -2);
		var image = obj.AddComponent<Image>();
		image.color = Color.grey;
		image.sprite = null;
		return obj;
	}

	private static void LaunchChess(int pad)
	{
		throw new System.NotImplementedException();
	}

	private static GameObject BuildChessRenderer(ChessTypeName type, int left, int right)
	{
		var obj = new GameObject();
		ApplyBoardCellLayout(obj, new Vector3(.618f, .618f, .618f));
		obj.transform.localPosition = new Vector3(right * 64 + 32 + 64, - left * 64 - 32 - 64, -1);
		var spriteRenderer = obj.AddComponent<SpriteRenderer>();
		spriteRenderer.sprite = Resources.Load<Sprite>(ChessTypeManager.Get(type).Name);
		return obj;
	}

	private static void ApplyBoardCellLayout(GameObject obj) => ApplyBoardCellLayout(obj, new Vector3(1, 1, 1));

	private static void ApplyBoardCellLayout(GameObject obj, Vector3 scale)
	{
		var trans = obj.AddComponent<RectTransform>();
		trans.localScale = scale;
		trans.anchorMin = trans.anchorMax = new Vector2(0.0f, 1.0f);
		trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, 64);
		trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, 64);
	}

	public void ResetBoard()
	{
		Debug.Log("Begin Updateing");
		new ChessBoard().MakeCurrent();
		UpdateChessBoard(gameObject);
		Debug.Log($"Board Updation {ChessBoard.Current.SizeLeft}, {ChessBoard.Current.SizeRight}");
	}

	private GameObject[] _chess;
}
