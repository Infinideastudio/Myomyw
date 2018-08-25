using System.Runtime.Serialization;
using Engine.Connection;
using Engine.Connection.Login;

namespace Engine.Network.Protocols
{
    public sealed class Login : GroupBase<Login>
    {
        static Login()
        {
            Name = "login";
        }

        private class HandleRequest : ProtocolBase<LoginRequest>
        {
            protected override void Handle(LoginRequest income, IoHelper io)
            {
                throw new System.NotImplementedException();
            }
        }

        private class HandleResponse : ProtocolBase<LoginResponse>
        {
            protected override void Handle(LoginResponse income, IoHelper io)
            {
                throw new System.NotImplementedException();
            }
        }

        public override IProtocol GetServerProtocol()
        {
            return new HandleRequest();
        }

        public override IProtocol GetClientProtocol()
        {
            return new HandleResponse();
        }
    }
}