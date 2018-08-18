using System;
using System.IO;

namespace Engine.Network
{
    public class ByteBuffer
    {
        private byte[] _buffer;

        private int _occupyed;

        public ByteBuffer(int length = 8192)
        {
            _buffer = new byte[length];
        }

        public void Occupy(int n)
        {
            _occupyed += n;
        }

        public ArraySegment<byte> GetRemaining(int least = 256)
        {
            if (_buffer.Length - _occupyed < least)
                Extend();
            return new ArraySegment<byte>(_buffer, _occupyed, _buffer.Length - _occupyed);
        }

        public MemoryStream Get()
        {
            return new MemoryStream(_buffer, 0, _occupyed, false);
        }

        public void Reset()
        {
            _occupyed = 0;
        }

        private void Extend()
        {
            var newBuffer = new byte[_buffer.Length * 2];
            Array.Copy(_buffer, 0, newBuffer, 0, _buffer.Length);
            _buffer = newBuffer;
        }
    }
}