using UnityEngine;
using UnityEngine.SceneManagement;

public class Game : MonoBehaviour
{
    // Use this for initialization
    private void Start()
    {
        
    }

    // Update is called once per frame
    private void Update()
    {
    }

    public void ExitGame()
    {
        SceneManager.LoadScene(0);
    }
}