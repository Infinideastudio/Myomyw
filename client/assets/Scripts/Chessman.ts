export enum Chessman {
    Common,
    AddCol,
    DelCol,
    Flip,
    Key
}

export type ChessmanWithData = {
    type: Chessman;
    data: string;
}
