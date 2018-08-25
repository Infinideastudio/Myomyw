using UnityEngine;

namespace UI.GameBoard.BoardGrid
{
    public static class GameObjectExt
    {
        public static void SetChessBoardLayout(this GameObject obj, Vector3 position)
        {
            obj.SetChessBoardLayout(position, new Vector3(1, 1, 1));
        }
        
        public static void SetChessBoardLayout(this GameObject obj, Vector3 position, Vector3 scale)
        {
            var trans = obj.AddComponent<RectTransform>();
            trans.localScale = scale;
            trans.localPosition = new Vector3(position.x * 64 + 32, -position.y * 64 - 32, -position.z);
            trans.anchorMin = trans.anchorMax = new Vector2(0.0f, 1.0f);
            trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, 64);
            trans.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, 64);
        }
    }
}