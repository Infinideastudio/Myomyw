using System.IO;
using System.Runtime.Serialization.Json;

namespace Engine.Network.Protocols
{
    public class ContractSerializable
    {
        private static class GetSerHelper<T>
        {
            public static readonly DataContractJsonSerializer Ser = new DataContractJsonSerializer(typeof(T));
        }
        
        public void WriteSer(DataContractJsonSerializer ser, Stream stream)
        {
            ser.WriteObject(stream, this);
        }

        public static T ReadSer<T>(DataContractJsonSerializer ser, Stream stream) where T : class
        {
            return ser.ReadObject(stream) as T;
        }
        
        public static T ReadShort<T>(Stream stream) where T : class
        {
            return ReadSer<T>(GetSer<T>(), stream);
        }

        public static DataContractJsonSerializer GetSer<T>()
        {
            return GetSerHelper<T>.Ser;
        }
    }
    
    public class ContractSerializable<T> : ContractSerializable where T : class
    {
        public void Write(Stream stream)
        {
           WriteSer(Ser, stream);
        }

        public static T Read(Stream stream)
        {
            return ReadSer<T>(Ser, stream);
        }

        private static readonly DataContractJsonSerializer Ser = GetSer<T>();
    }
}