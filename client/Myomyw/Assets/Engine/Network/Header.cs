using System.IO;
using System.Runtime.Serialization;
using Engine.Connection;
using Engine.Network.Protocols;

namespace Engine.Network
{
    [DataContract]
    
    public class Header: ContractSerializable<Header>
    {
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

        public Header Clone()
        {
            return MemberwiseClone() as Header;
        }
    }
}