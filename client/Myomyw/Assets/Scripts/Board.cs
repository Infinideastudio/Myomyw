using UnityEngine;

public class Board : MonoBehaviour
{
    public Transform centerPos;
    public GameObject Button;
    public GameObject Grid;
    public GameObject Common;
    public GameObject Add;
    public GameObject Del;
    public GameObject Flip;
    public GameObject Key;

    public float gridSize = 1.5f;
    public float gridDis = 1.01f;
    public float ballSize = 1.3f;

    private int boardSizeRow = 3, boardSizeCol = 3;

    private Vector3[,] gridPos = new Vector3[14, 14];

    // Start is called before the first frame update
    void Start()
    {
        centerPos.localScale = new Vector3(gridSize, gridSize, 1);
        for (int row = 0; row <= boardSizeRow; row++)
        {
            for (int col = 0; col <= boardSizeCol; col++)
            {
                if (row == 0 && col == 0) continue;
                float x = centerPos.position.x - row * (gridSize * gridDis / Mathf.Sqrt(2)) +
                          col * (gridSize * gridDis / Mathf.Sqrt(2));
                float y = centerPos.position.y - row * (gridSize * gridDis / Mathf.Sqrt(2)) -
                          col * (gridSize * gridDis / Mathf.Sqrt(2));
                gridPos[row, col] = new Vector3(x, y, 0);
                GameObject item;
                if (row == 0 || col == 0) item = Instantiate(Button, new Vector3(x, y, 0), Quaternion.Euler(0, 0, 45));
                else item = Instantiate(Grid, new Vector3(x, y, 0), Quaternion.Euler(0, 0, 45));
                item.transform.localScale = new Vector3(gridSize, gridSize, 1);
            }
        }

        for (int row = 1; row <= boardSizeRow; row++)
        {
            for (int col = 1; col <= boardSizeCol; col++)
            {
                GameObject ball = Instantiate(Common, gridPos[row, col], Quaternion.Euler(0, 0, 0));
                ball.transform.localScale = (new Vector3(ballSize * gridSize, ballSize * gridSize, 0));
            }
        }

        // Update is called once per frame
        void Update()
        {
            if (Input.GetMouseButtonDown(0))
            {

            }
        }
    }
}