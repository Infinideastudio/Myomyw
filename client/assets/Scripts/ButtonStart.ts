const {ccclass, property} = cc._decorator;

@ccclass
export class ButtonStart extends cc.Component {
    public onButtonClicked(event:cc.Event,msg:string):void{
        switch(msg){
            case 'start':
                cc.director.loadScene("Login");
                break;
            default:
                throw(new Error('unexpected msg:' + msg));
        }
        return;
    }
}