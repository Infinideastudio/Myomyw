// ReSharper disable StaticMemberInGenericType
namespace Engine.Network.Protocols
{
    public class GroupBase<T>
    {
        protected static string Name { get; set; }

        protected abstract class ProtocolBase<TMessage> : IProtocol where TMessage : ContractSerializable
        {
            // ReSharper disable once MemberHidesStaticFromOuterClass
            public string Name => GroupBase<T>.Name;

            public void Handle(IoHelper io)
            {
                Handle(ContractSerializable.ReadShort<TMessage>(io.InStream), io);
            }

            protected abstract void Handle(TMessage income, IoHelper io);
        }
       
    }
}