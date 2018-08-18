using System;
using System.IO;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;

namespace Assets.GameEngine
{
    public class Client
    {
        private readonly ClientWebSocket _webSocket;

        public Client()
        {
            _webSocket = new ClientWebSocket();
        }

        public void Connect(string uri)
        {
            _webSocket.ConnectAsync(new Uri(uri), CancellationToken.None).Wait();
        }

        public async Task ListenAsync()
        {
            ProtocolHub.LockAccess();
            var buffer = new ByteBuffer();
            while (_webSocket.State != WebSocketState.Closed)
            {
                var message = await ReadMessage(buffer);
                var protocol = ProtocolHub.Get(MessageHeader.Unpack(message));
            }

            ProtocolHub.ReleaseAccess();
        }

        private async Task<MemoryStream> ReadMessage(ByteBuffer buffer)
        {
            var messageComplete = false;
            buffer.Reset();
            while (!messageComplete)
            {
                var result = await _webSocket.ReceiveAsync(buffer.GetRemaining(), CancellationToken.None);
                messageComplete = result.EndOfMessage;
                buffer.Occupy(result.Count);
            }

            return buffer.Get();
        }

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
}