using System;
using System.IO;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;

namespace Engine.Network
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
    }
}