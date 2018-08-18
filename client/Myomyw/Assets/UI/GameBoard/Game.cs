using UnityEngine;
using UnityEngine.SceneManagement;

namespace Assets.UI.GameBoard
{
    public class Game : MonoBehaviour
    {
        public void ExitGame()
        {
            SceneManager.LoadScene(0);
        }
    }
}