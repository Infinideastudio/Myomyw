using System;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Threading;
using UnityEngine;

namespace Assets.GameEngine
{
    public class Register
    {
        [DataContract]
        public class Send
        {
            [DataMember] public string email;

            [DataMember] public string username;

            public Send(string iUsername, string iEmail)
            {
                username = iUsername;
                email = iEmail;
            }

            public string GetJson()
            {
                return JsonUtility.ToJson(this, true);
            }
        }

        public class Reply
        {
            public static Reply Unpack(string from)
            {
                return JsonUtility.FromJson<Reply>(from);
            }
        }
    }

    public interface IProtocol
    {
        void Handle();
    }

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