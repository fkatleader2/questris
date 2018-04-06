tetresse.modules["tetresse-socket"] = {
    socket: io.connect(),
    active: false,
    playerId: -1,
    setup(game) {
        if (!active) {
            replaySetup();
            playableBoardSetup(game);
        }
        active = true;
    },
    playableBoardSetup(game) {
        game.listeners.add("action",
            function(args, action) {
                var socket = tetresse.modules["tetresse-socket"].socket;
                socket.emit('action', {time: (new Date()).getTime(),
                    type: "a",
                    data: action
                });
        });
        game.listeners.add("spawned", function(args, piece) {
            var socket = tetresse.modules["tetresse-socket"].socket;
            socket.emit('action', {time: (new Date()).getTime(),
                    type: "p",
                    data: piece
                });
        });
        game.listeners.add("placed",
            function(args1, args2) {
                var socket = tetresse.modules["tetresse-socket"].socket;
                socket.emit('boardUpdate', args2);
            }
        });
    },
    replaySetup() {
        var socket = tetresse.modules["tetresse-socket"].socket;
        socket.on('boardUpdate', function(data) { // in same form as sent ie. array of tiles placed
            var game = tetresse.modules["tetresse-socket"].getGame(data.playerId);
            for (var i = 0; i < data.length; i++)
                game.board[data[i].r][data[i].c].content = data[i].content;
            game.listeners.execute("placed", data);
        });
        socket.on('action', function(data) {
            var game = tetresse.modules["tetresse-socket"].getGame(data.playerId);
            if (data.type == "p")
                game.piece.next(data.data);
            else if (data.type == "a")
                game.action.add({i: data.data});
        });
        socket.on('playerId', function(data) {
            tetresse.modules["tetresse-socket"].playerId = data;
        });
        socket.on('joinRoom', function(data) {
            console.log('someone joined');
        });
    },
    getGame(id) {
        var sm = tetresse.modules["tetresse-socket"].playerId;
        var game = tetresse.games[(id - sm + tetresse.games.length) % tetresse.games.length];
        return game;
    }
}