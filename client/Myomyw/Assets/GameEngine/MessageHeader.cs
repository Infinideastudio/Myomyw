using System.IO;
using System.Runtime.Serialization;

namespace Assets.GameEngine
{
    [DataContract]
    public class MessageHeader
    {
        private static readonly DataContractSerializer Serializerer = new DataContractSerializer(typeof(MessageHeader));

        [DataMember] internal string action;

        private MessageHeader(string act)
        {
            action = act;
        }

        public static void Pack(string action, Stream to)
        {
            Serializerer.WriteObject(to, new MessageHeader(action));
        }

        public static string Unpack(Stream from)
        {
            return ((MessageHeader) Serializerer.ReadObject(from)).action;
        }
    }
}