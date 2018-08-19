namespace Engine.Network
{
    public interface IProtocol
    {
        string Name { get; }
        void Handle(IoHelper io);
    }
}