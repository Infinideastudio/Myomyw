const { ccclass, property } = cc._decorator;

@ccclass
export class ButtonLogin extends cc.Component {
    @property(cc.EditBox)
    public userName: cc.EditBox = new cc.EditBox();
    public onButtonClicked(event: cc.Event, msg: string): void {
        switch (msg) {
            case 'login':
                console.log('username:' + this.userName.string);
                cc.director.loadScene("Game");
                break;
            default:
                throw (new Error('unexpected msg:' + msg));
        }
        return;
    }
}