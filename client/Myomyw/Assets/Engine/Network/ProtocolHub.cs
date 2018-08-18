using System;
using System.Collections.Generic;
using System.Threading;

namespace Engine.Network
{
    public static class ProtocolHub
    {
        private static readonly Dictionary<string, IProtocol> Protocols = new Dictionary<string, IProtocol>();

        private static readonly Mutex AccessLock = new Mutex();

        public static IProtocol Get(string actionName)
        {
            return Protocols[actionName];
        }

        public static void Set(string name, IProtocol protocol)
        {
            if (TryLock())
                Protocols.Add(name, protocol);
            else
                throw new Exception("Adding Protocol is Not Allowed at This Time");
        }

        public static void LockAccess()
        {
            AccessLock.WaitOne();
        }

        public static void ReleaseAccess()
        {
            AccessLock.ReleaseMutex();
        }

        private static bool TryLock()
        {
            return AccessLock.WaitOne(0);
        }
    }
}