// Verbatim excerpt of the original client/src/definitions.js (Beta 0.8),
// without the Cocos-specific parts. Loaded by legacy.ts as a test oracle.
var maxLCol = 10, maxRCol = 10;
var minLCol = 3, minRCol = 3;
var defaultLCol = 6, defaultRCol = 6;
var maxMovements = 5;

var Chessman = { common: 0, key: 1, addCol: 2, delCol: 3, flip: 4 };
var left = 0, right = 1, both = 2, neither = 3;

function getRandomChessman() {
    switch (Math.floor(Math.random() * 11)) {
        case 0:
            return Chessman.key;
        case 1:
            return Chessman.addCol;
        case 2:
            return Chessman.delCol;
        case 3:
            return Chessman.flip;
        default:
            return Chessman.common;
    }
}
