using System.IO;
using System.Runtime.Serialization;

namespace Engine.Network
{
    [DataContract]
    public class MessageHeader
    {
        private static readonly DataContractSerializer Serializerer = new DataContractSerializer(typeof(MessageHeader));

        [DataMember(Name = "action", IsRequired = true)]
        internal string Action;

        [DataMember(Name = "ref", IsRequired = false)]
        internal int RefId;

        [DataMember(Name = "error_code", IsRequired = false)]
        internal int ErrorCode;

        private MessageHeader(string act)
        {
            Action = act;
        }

        public static void Pack(string action, Stream to)
        {
            Serializerer.WriteObject(to, new MessageHeader(action));
        }

        public static string Unpack(Stream from)
        {
            return ((MessageHeader) Serializerer.ReadObject(from)).Action;
        }
    }
}