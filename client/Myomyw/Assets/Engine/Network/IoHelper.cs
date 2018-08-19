using System;
using System.IO;

namespace Engine.Network
{
    public class IoHelperBuffer
    {
        private readonly ByteBuffer _inUnderlyBuffer;
        private readonly MemoryStream _outBuffer = new MemoryStream();

        private MemoryStream _inBuffer;

        public IoHelperBuffer(EndPoint endpoint, ByteBuffer inUnderlybuffer)
        {
            _inUnderlyBuffer = inUnderlybuffer;
            EndPoint = endpoint;
        }

        public Stream InBuffer => _inBuffer;

        public Stream OutBuffer => _outBuffer;

        public EndPoint EndPoint { get; }

        public void ResetIn()
        {
            _inBuffer = _inUnderlyBuffer.Get();
        }
    }

    public class IoHelper
    {
        private readonly IoHelperBuffer _buffer;

        private int _replyStat;

        public IoHelper(IoHelperBuffer buffer, Header header)
        {
            _buffer = buffer;
        }

        public Stream InStream => _buffer.InBuffer;

        public Stream OutStream => _replyStat == 1 ? _buffer.OutBuffer : null;

        public EndPoint EndPoint => _buffer.EndPoint;

        public void BeginReply()
        {
            if (_replyStat == 0)
                _replyStat = 1;
            else
                throw new Exception("Replying Is Not Allowed At This Time");
        }
        
        public void EndReply()
        {
            _replyStat = 2;
        }
    }
}