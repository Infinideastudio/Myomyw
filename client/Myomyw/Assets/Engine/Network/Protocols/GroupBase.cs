// ReSharper disable StaticMemberInGenericType

using System;
using Engine.Connection;

namespace Engine.Network.Protocols
{
    public abstract class GroupBase<T> where T : GroupBase<T>
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

        public abstract IProtocol GetServerProtocol();

        public abstract IProtocol GetClientProtocol();

        public static T Instance
        {
            get
            {
                if (_internalInstance == null)
                    _internalInstance = Activator.CreateInstance<T>();
                return _internalInstance;
            }
        }

        private static T _internalInstance;
    }
}