package gamemanager
import "math/rand"
const (
	Common = 0
    Key = 1
    Flip = 2
    AddCol = 3
    DelCol = 4
)
type GameBoard struct {
	Row int
	Col int
	MaxRow int
	MaxCol int
	MinRow int
	MinCol int
	Board  [10][10]int
}
func (game *GameBoard) Init(row,col,minRow,minCol,maxRow,maxCol int) {
	game.Row = row
	game.Col = col
	game.MaxRow = maxRow
	game.MaxCol = maxCol
	game.MinRow = minRow
	game.MinCol = minCol
	for i := 0; i < 10; i++{
		for j := 0; j < 10; j++{
			game.Board[i][j] = Common
		}
	}
}
func randBall() int{
	rand.Intn(4)
	return Flip
}
//return value: new ball,out ball
func (game *GameBoard) pushRowOnce(row int) (int,int){
    var outBall int 
	outBall=game.Board[row][game.Col - 1]
	switch game.Board[row][game.Col - 1]{
	case DelCol:
		if game.Col > game.MinCol{
			for i := game.Row - 1; i >= 0; i--{
				game.Board[i][game.Col - 1]=Common
			}
			game.Col --
		}	
	case AddCol:
		if game.Col < game.MaxCol{
			game.Board[row][game.Col - 1]=Common
			game.Col ++
		}
	default:
	}	
	for i := game.Col - 1; i > 0; i--{
		game.Board[row][i]=game.Board[row][i-1]
	}
	var newBall int
	newBall=randBall();
	game.Board[row][0] = newBall
	if outBall==Flip{
		var temp  [10][10]int
		for i := 0; i < 10; i++{
			for j := 0; j < 10; j++{
				temp[i][j]=game.Board[j][i]
			}
		}
		for i := 0; i < 10; i++{
			for j := 0; j < 10; j++{
				game.Board[i][j]=temp[i][j];
			}
		}
		var swtemp int
		swtemp=Row
		Row=Col
		Col=swtemp
	}
	return newBall,outBall
}
func (game *GameBoard) pushColOnce(col int) (int,int){
    var outBall int 
	outBall=game.Board[game.Row - 1][col]
	switch game.Board[game.Row - 1][col]{
	case DelCol:
		if game.Row > game.MinRow{
			for i := game.Col - 1; i >= 0; i--{
				game.Board[game.Row - 1][i]=Common
			}
			game.Row --
		}	
	case AddCol:
		if game.Row < game.MaxRow{
			game.Board[game.Row - 1][col]=Common
			game.Row ++
		}
	default:
	}	
	for i := game.Row - 1; i > 0; i--{
		game.Board[i][col]=game.Board[i-1][col]
	}
	var newBall int
	newBall=randBall();
	game.Board[0][col] = newBall
	if outBall==Flip{
		var temp  [10][10]int
		for i := 0; i < 10; i++{
			for j := 0; j < 10; j++{
				temp[i][j]=game.Board[j][i]
			}
		}
		for i := 0; i < 10; i++{
			for j := 0; j < 10; j++{
				game.Board[i][j]=temp[i][j];
			}
		}
		var swtemp int
		swtemp=Row
		Row=Col
		Col=swtemp
	}
	return newBall,outBall
}
//return value: die
func (game *GameBoard) PushRow(row,times int) bool{
	var die bool
	die = false;
	for i := 0; i < times; i++{
		new,out:=game.pushRowOnce(row)
		if new==0 {}
		if out==Key {
			die=true
			break;
		}
		if out==Flip {
			break;
		}
	}
	return die
}
func (game *GameBoard) PushCol(col,times int) bool{
	var die bool
	die = false;
	for i := 0; i < times; i++{
		new,out:=game.pushColOnce(col)
		if new==0 {}
		if out==Key {
			die=true
			break;
		}
		if out==Flip {
			break;
		}
	}
	return die
}