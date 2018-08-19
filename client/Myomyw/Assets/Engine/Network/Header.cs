using System.IO;
using System.Runtime.Serialization;

namespace Engine.Network
{
    [DataContract]
    public class Header
    {
        private static readonly DataContractSerializer Serializerer = new DataContractSerializer(typeof(Header));

        [DataMember(Name = "action", IsRequired = true)]
        internal string Action;

        [DataMember(Name = "ref", IsRequired = false)]
        internal int RefId;

        [DataMember(Name = "error_code", IsRequired = false)]
        internal int ErrorCode;

        private Header(string act)
        {
            Action = act;
        }

        public static void Pack(string action, Stream to)
        {
            Serializerer.WriteObject(to, new Header(action));
        }

        public static string Unpack(Stream from)
        {
            return ((Header) Serializerer.ReadObject(from)).Action;
        }
    }
}