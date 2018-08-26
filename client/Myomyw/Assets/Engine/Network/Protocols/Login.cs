namespace Engine.Network.Protocols
{
    public sealed class PrLogin : GroupBase<PrLogin>
    {
        static PrLogin()
        {
            Name = "login";
        }

        private class HandleRequest : ProtocolBase<Connection.Login.Request>
        {
            protected override void Handle(Connection.Login.Request income, IoHelper io)
            {
                throw new System.NotImplementedException();
            }
        }

        private class HandleResponse : ProtocolBase<Connection.Login.Response>
        {
            protected override void Handle(Connection.Login.Response income, IoHelper io)
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