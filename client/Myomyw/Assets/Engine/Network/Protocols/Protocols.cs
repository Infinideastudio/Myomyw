using System.IO;
using System.Runtime.Serialization;

namespace Engine.Network.Protocols
{
    public class Register
    {
        [DataContract]
        public class Send
        {
            [DataMember(Name = "email", IsRequired = true)] public string Email;

            [DataMember(Name = "username", IsRequired = true)] public string Username;

            public Send(string username, string email)
            {
                Username = username;
                Email = email;
            }

            public void Write(Stream stream)
            {
                Ser.WriteObject(stream, this);
            }
            
            private static readonly DataContractSerializer Ser = new DataContractSerializer(typeof(Send));
        }

        public class Reply
        {
            public static Reply Read(Stream stream)
            {
                return Ser.ReadObject(stream) as Reply;
            }
            
            private static readonly DataContractSerializer Ser = new DataContractSerializer(typeof(Reply));
        }
    }

}