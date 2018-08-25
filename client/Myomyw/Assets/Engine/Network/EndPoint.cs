using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;

namespace Engine.Network
{
    public abstract class EndPoint
    {
        public abstract void Send(ArraySegment<byte> messaage);

        public void Send(byte[] message)
        {
            Send(new ArraySegment<byte>(message));
        }
    }

    public class Client : EndPoint
    {
        private readonly ClientWebSocket _webSocket;

        private readonly object _writelock = new object();

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
            var ioBuffer = new IoHelperBuffer(this, buffer);
            while (_webSocket.State != WebSocketState.Closed)
            {
                await ReadMessage(buffer);
                ioBuffer.ResetIn();
                var header = Header.Read(ioBuffer.InBuffer);
                var protocol = ProtocolHub.Get(header.Action);
                protocol.Handle(new IoHelper(ioBuffer, header));
            }

            ProtocolHub.ReleaseAccess();
        }

        private async Task ReadMessage(ByteBuffer buffer)
        {
            var messageComplete = false;
            buffer.Reset();
            while (!messageComplete)
            {
                var result = await _webSocket.ReceiveAsync(buffer.GetRemaining(), CancellationToken.None);
                messageComplete = result.EndOfMessage;
                buffer.Occupy(result.Count);
            }
        }

        public override void Send(ArraySegment<byte> messaage)
        {
            lock (_writelock)
            {
                _webSocket.SendAsync(messaage, WebSocketMessageType.Text, true, CancellationToken.None).Wait();
            }
        }
    }
}