using System;
using System.IO;

namespace Engine.Network
{
    public class IoHelperBuffer
    {
        private readonly ByteBuffer _inUnderlyBuffer;

        private MemoryStream _inBuffer;

        public IoHelperBuffer(EndPoint endpoint, ByteBuffer inUnderlybuffer)
        {
            _inUnderlyBuffer = inUnderlybuffer;
            EndPoint = endpoint;
        }

        public Stream InBuffer => _inBuffer;

        public MemoryStream OutBuffer { get; } = new MemoryStream();

        public EndPoint EndPoint { get; }

        public void ResetIn()
        {
            _inBuffer = _inUnderlyBuffer.Get();
        }
    }

    public class IoHelper
    {
        private readonly IoHelperBuffer _buffer;

        private readonly Header _header;

        private int _replyStat;

        public IoHelper(IoHelperBuffer buffer, Header header)
        {
            _buffer = buffer;
            _header = header.Clone();
        }

        public Stream InStream => _buffer.InBuffer;

        public MemoryStream OutStream => _replyStat == 1 ? _buffer.OutBuffer : null;

        public EndPoint EndPoint => _buffer.EndPoint;

        public void BeginReply(int ec)
        {
            if (_replyStat == 0)
                _replyStat = 1;
            else
                throw new Exception("Replying Is Not Allowed At This Time");
            _header.ErrorCode = ec;
            _header.Write(OutStream);
        }

        public void EndReply()
        {
            _replyStat = 2;
            EndPoint.Send(OutStream.ToArray());
            OutStream.Position = 0;
            OutStream.SetLength(0);
        }
    }
}