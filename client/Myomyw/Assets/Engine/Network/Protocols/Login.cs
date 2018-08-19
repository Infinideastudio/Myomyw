using System.Runtime.Serialization;

namespace Engine.Network.Protocols
{
    public class Login : GroupBase<Login>
    {
        static Login()
        {
            Name = "login";
        }
        
        [DataContract]
        public class LoginRequest : ContractSerializable<LoginRequest>
        {
            [DataMember(Name = "username", IsRequired = true)]
            public string Username;

            [DataMember(Name = "version", IsRequired = true)]
            public string Version;

            [DataMember(Name = "uuid", IsRequired = false)]
            public string Uuid;
        }

        [DataContract]
        public class Rank : ContractSerializable<Rank>
        {
            [DataMember(Name = "username", IsRequired = true)]
            public string Username;

            [DataMember(Name = "rating", IsRequired = true)]
            public int Rating;
        }
        
        [DataContract]
        public class Room: ContractSerializable<Room>
        {
            [DataMember(Name = "id", IsRequired = true)]
            public int Id;

            [DataMember(Name = "waiting", IsRequired = true)]
            public bool Waiting;

            [DataMember(Name = "players", IsRequired = true)]
            public string[] Players;

            [DataMember(Name = "locked", IsRequired = true)]
            public bool Locked;
        }

        [DataContract]
        public class LoginResponse: ContractSerializable<LoginResponse>
        {
            [DataMember(Name = "uuid", IsRequired = true)]
            public string Uuid;

            [DataMember(Name = "rating", IsRequired = false)]
            public int Rating;

            [DataMember(Name = "rank", IsRequired = false)]
            public Rank[] Ranks;
            
            [DataMember(Name = "rooms", IsRequired = false)]
            public Room[] Rooms;
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
    }
}