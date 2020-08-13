const { ccclass, property } = cc._decorator;

@ccclass
export class ButtonLogin extends cc.Component {
    @property(cc.EditBox)
    public userName: cc.EditBox;
    public onButtonClicked(event: cc.Event, msg: string): void {
        switch (msg) {
            case 'login':
                console.log('username:' + this.userName.string);
                break;
            default:
                throw (new Error('unexpected msg:' + msg));
        }
        return;
    }
}