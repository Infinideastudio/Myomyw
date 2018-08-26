using System.Threading.Tasks;
using Engine.Connection.Login;

namespace Engine.Connection
{
    public class LSinglePlayer : IConnection
    {
        public Response Login(Request request)
        {
            throw new System.NotImplementedException();
        }

        public void EnterRoom(EnterRoom.Request request)
        {
            throw new System.NotImplementedException();
        }

        public Task WaitForGameStart()
        {
            throw new System.NotImplementedException();
        }

        public void LaunchBall(LaunchBall.Request request)
        {
            throw new System.NotImplementedException();
        }

        public Task WaitForOpponentOperate()
        {
            throw new System.NotImplementedException();
        }
    }
}