import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
    grid: Array(5).fill().map(() => Array(5).fill(null)),
    players: {},
    currentPlayer: null,
    gameOver: false,
};

function initializeGame() {
    gameState.grid = Array(5).fill().map(() => Array(5).fill(null));
    gameState.currentPlayer = 'A'; 
    gameState.gameOver = false;
}

initializeGame();


function processMove(player, character, move) {
    const opponent = player === 'A' ? 'B' : 'A';
    const currentPlayerCharacters = getPlayerCharacters(player);
    const opponentCharacters = getPlayerCharacters(opponent);
    let [charRow, charCol] = findCharacterPosition(player, character);

    if (!charRow && !charCol) {
        return; 
    }

    let newRow = charRow, newCol = charCol;
    switch (character) {
        case 'Pawn':
            if (move === 'L') newCol--;
            if (move === 'R') newCol++;
            if (move === 'F') newRow--;
            if (move === 'B') newRow++;
            break;
        case 'Hero1':
            if (move === 'L') newCol -= 2;
            if (move === 'R') newCol += 2;
            if (move === 'F') newRow -= 2;
            if (move === 'B') newRow += 2;
            break;
        case 'Hero2':
            if (move === 'FL') { newRow -= 2; newCol--; }
            if (move === 'FR') { newRow -= 2; newCol++; }
            if (move === 'BL') { newRow += 2; newCol--; }
            if (move === 'BR') { newRow += 2; newCol++; }
            break;
        default:
            return; 
    }

    if (newRow < 0 || newRow >= 5 || newCol < 0 || newCol >= 5) {
        return; 
    }

    if (gameState.grid[newRow][newCol] && gameState.grid[newRow][newCol].startsWith(player)) {
        return; 
    }

    if (gameState.grid[newRow][newCol] && gameState.grid[newRow][newCol].startsWith(opponent)) {
        removeCharacter(opponent, newRow, newCol);
    }

    gameState.grid[charRow][charCol] = null; 
    gameState.grid[newRow][newCol] = `${player}-${character}`;

    gameState.currentPlayer = opponent;

    if (opponentCharacters.length === 0) {
        gameState.gameOver = true;
        io.emit('game-over', `Player ${player} wins!`);
    }
}

function getPlayerCharacters(player) {
    return gameState.grid.flat().filter(cell => cell && cell.startsWith(player));
}

function findCharacterPosition(player, character) {
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            if (gameState.grid[row][col] === `${player}-${character}`) {
                return [row, col];
            }
        }
    }
    return [null, null]; 
}

function removeCharacter(player, row, col) {
    gameState.grid[row][col] = null;
    io.emit('character-removed', `${player} character removed at [${row}, ${col}]`);
}

io.on('connection', (socket) => {
    console.log('a player connected:', socket.id);

    if (!gameState.players['A']) {
        gameState.players['A'] = socket.id;
        socket.emit('player-assign', 'A');
    } else if (!gameState.players['B']) {
        gameState.players['B'] = socket.id;
        socket.emit('player-assign', 'B');
        io.emit('game-start');
    } else {
        socket.emit('error', 'Game is already in progress');
    }

    socket.on('move', (data) => {
        const { player, character, move } = data;

        if (gameState.currentPlayer && !gameState.gameOver) {
            if (socket.id === gameState.players[gameState.currentPlayer]) {
                processMove(gameState.currentPlayer, character, move);
                io.emit('game-update', gameState);
            } else {
                socket.emit('invalid-move', 'Not your turn');
            }
        } else {
            socket.emit('invalid-move', 'Game over or not your turn');
        }
    });
    socket.on('disconnect', () => {
        console.log('player disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
