using System;
using System.Runtime.Serialization;
using System.Threading.Tasks;

namespace Engine.Connection
{
    public class ServerException : Exception
    {
        public enum Reason
        {
            Success = 0,
            ServerAuthFailure = 1,
            ServerBusy = 2,
            VersionMismatch = 3,
            RoomIsFull = 0x11,
            TooManyRooms = 0x12,
            RoomAuthFailure = 0x13,
            GameReadyFailure = 0x21,
            Uke = 255
        }
    }
    
    namespace Login
    {
        [DataContract]
        public class Request : ContractSerializable<Request>
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
        public class Response: ContractSerializable<Response>
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
    }

    namespace EnterRoom
    {
        [DataContract]
        public class Request : ContractSerializable<Request>
        {
            [DataMember(Name = "uuid", IsRequired = true)]
            public string Uuid;

            [DataMember(Name = "watched", IsRequired = true)]
            public bool IsRequired;

            [DataMember(Name = "new_room", IsRequired = true)]
            public bool NewRoom;

            [DataMember(Name = "room_id", IsRequired = true)]
            public int RoomId;

            [DataMember(Name = "password", IsRequired = true)]
            public string Password;
        }
    }

    namespace LaunchBall
    {
        [DataContract]
        public class Request : ContractSerializable<Request>
        {
            [DataMember(Name = "uuid", IsRequired = true)]
            public string Uuid;

            [DataMember(Name = "col", IsRequired = true)]
            public int Col;
        }
    }
    
    public interface IConnection
    {
        Login.Response Login(Login.Request request);
        void EnterRoom(EnterRoom.Request request);
        Task WaitForGameStart();
        void LaunchBall(LaunchBall.Request request);
        Task WaitForOpponentOperate();
        
    }
}