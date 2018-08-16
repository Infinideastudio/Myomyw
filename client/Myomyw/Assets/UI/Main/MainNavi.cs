using UnityEngine;
using UnityEngine.SceneManagement;

public class MainNavi : MonoBehaviour
{
    // Use this for initialization
    private void Start()
    {
    }

    // Update is called once per frame
    private void Update()
    {
    }

    public void ClickStart()
    {
        SceneManager.LoadScene(1);
    }
}