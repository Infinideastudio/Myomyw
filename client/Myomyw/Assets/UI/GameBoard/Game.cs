using UnityEngine;
using UnityEngine.SceneManagement;

namespace UI.GameBoard
{
    public class Game : MonoBehaviour
    {
        public void ExitGame()
        {
            SceneManager.LoadScene(0);
        }
    }
}