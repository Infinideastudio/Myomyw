using UnityEngine;
using UnityEngine.SceneManagement;

public class BackGround : MonoBehaviour
{
    public void ExitGame()
    {
        SceneManager.LoadScene(0);
    }
}