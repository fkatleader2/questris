/**
 * TODO: make display use images
 */
class Tetresse {
    /**
     * Sets up this Tetresse implementation with given args
     * args - settings, extensions, etc
     */
    constructor(args) {
        this.settings = {
            replay: args.replay == null ? false : args.replay,
            game: {
                board: {
                    shownRows: 20,
                    hiddenRows: 20,
                    cols: 10
                },
                display: {
                    canvas: args.canvas,
                    x: args.x == null ? .3 : args.x, // x location as percentage of canvas
                    y: args.y == null ? 0 : args.y,
                    width: args.w == null ? 1 : args.w, // max width as percentage of canvas
                    height: args.h == null ? 1 : args.h, 
                    nextPieces: 5,
                },
                play: {
                    gravity: {
                        enabled: true,
                        speed: 1000, // in ms
                        stall: 15, // number of times you stall
                    },
                    LCDelay: 500 // line clear delay (in ms)
                }
            },
            user: {
                pieceMovement: {
                    ARR: 16, // auto repeat rate in ms
                    DAS: 150, // delayed auto shift in ms
                    SDD: 25, // soft drop delay in ms
                }
            },
            modules: {

            }
        };

        // env vars
        Tetresse.envSetup();
        this.id = tetresse.games.length;
        window.tetresse.games[this.id] = this;

        // listeners
        this.listeners = this.setupListeners();

        // display
        Tetresse.setupDisplay();
        this.board = this.createBoard();
        this.display = this.createDisplay();
        tetresse.listeners.resize.resume();
        this.initializeDisplay();

        // piece
        this.piece = this.setupPiece();
        this.initializeLineClear();
        
        // peripherals

        // actions
        this.actions = this.createActions();
        this.setupActions();

        // keybinds
        if (!this.settings.replay) {
            Tetresse.setupBinds();
            this.initializeBinds();
            tetresse.listeners.binds.resume();
        }

        for (var v in tetresse.modules) // TODO allow this setting to be changed (setup earlier in construction)
            tetresse.modules[v].setup(this);

        this.listeners.execute("startGame");
        // start clock
        // this.listeners.clock.resume();
    }

    initializeModules(args) {
        if (args.modules != null) {
            this.settings.modules = {};
            for (var i = 0 ; i < args.modules.length; i++) {
                var v = exports[args.modules[i]];
                v.setup(this);
                this.settings.modules[args.modules[i]] = v;
            }
        }
    }

    initializeLineClear() {
        this.listeners.add("placed",
            function(args) {
                var b = args.game.board;
                var numCleared = 0;
                var topRow = 0;
                var botRow = -1;
                for (var r = b.length - 1; r >= 0; r--) {
                    var filled = true;
                    var empty = true;
                    for (var c = 0; c < b[0].length; c++) {
                        if (b[r][c].content == "") filled = false; else empty = false;
                    }
                    if (empty) break;
                    if (!filled) {
                        if (numCleared != 0) {
                            var temp = b[r + numCleared];
                            b[r + numCleared] = b[r];
                            b[r] = temp;
                        }
                    } else {
                        if (botRow == -1) botRow = r + 1;
                        numCleared++;
                        for (var c = 0; c < b[0].length; c++)
                            b[r][c].content = "";
                    }
                    topRow = r;
                }
                var d = args.game.display;
                var l = args.game.listeners;
                if (numCleared != 0) {
                    d.update({type: "boardContent", display: args.game.display, r1: topRow, r2: botRow}); // finish
                    args.game.actions.pause();
                    args.game.piece.gravity.setState(false);
                    window.setTimeout(function(game) {
                        game.piece.next();
                        game.actions.clear();
                        game.actions.resume();
                        game.piece.gravity.setState(true);
                    }, args.game.settings.game.play.LCDelay, args.game);
                } else {
                    args.game.piece.next();
                }
                l.execute(numCleared + "-linesCleared");
                
            }, {game: this});
    }

    initializeBinds() {
        Tetresse.setupBinds();
        var k = tetresse.listeners.binds;
        var arr = [
            {keyCodeLabel: "down", keyCode: 40, funcLabel: "sd", i: 3, delay: this.settings.user.pieceMovement.SDD},
            {keyCodeLabel: "right", keyCode: 39, funcLabel: "right", i: 1, delay: this.settings.user.pieceMovement.ARR, firstDelay: this.settings.user.pieceMovement.DAS},
            {keyCodeLabel: "up", keyCode: 38, funcLabel: "cw", i: 4, delay: -1},
            {keyCodeLabel: "left", keyCode: 37, funcLabel: "left", i: 0, delay: this.settings.user.pieceMovement.ARR, firstDelay: this.settings.user.pieceMovement.DAS},
            {keyCodeLabel: "space", keyCode: 32, funcLabel: "hd", i: 2, delay: -1},
            {keyCodeLabel: "z", keyCode: 90, funcLabel: "ccw", i: 5, delay: -1},
            {keyCodeLabel: "c", keyCode: 67, funcLabel: "hold", i: 6, delay: -1}
        ];

        // customizable repeat
        // args: {index, funcOnpress (self), funcOnRelease, argsOnPress, argsOnRelease, game}
        var arrKey = function(args) { // {game, active: {a}, i, keyCode, keyDown, delay, firstDelay}
            if (args.keyDown) { // start loop
                var v = function(args, first) {
                    args.game.actions.add({i: args.i});
                    if (args.delay == -1) {args.timeout.id = null; return;}
                    args.timeout.id = window.setTimeout(args.func, first ? args.firstDelay != null ? args.firstDelay : args.delay : args.delay, args, false);
                }
                args.func = v;
                v(args, true);
            } else { // end loop
                clearTimeout(args.timeout.id);
                args.timeout.id = null;
            }
            tetresse.listeners.binds.pause({keyCode: args.keyCode});
            tetresse.listeners.binds.resume({keyCode: args.keyCode, onKeyDown: !args.keyDown, onKeyUp: args.keyDown});
        };
        var arrKeyLeftRight = function(args) { // {game, active: {a}, i, keyCode, keyDown, delay, firstDelay, label}
            if (args.keyDown) { // start loop
                var v = function(args, first) {
                    if (args.state[args.label]) args.game.actions.add({i: args.i});
                    args.timeout.id = window.setTimeout(args.func, first ? args.firstDelay != null ? args.firstDelay : args.delay : args.delay, args, false);
                }
                args.func = v;
                args.state[args.label] = true;
                args.state[args.label == "left" ? "right" : "left"] = false;
                v(args, true);
            } else { // end loop
                args.state[args.label == "left" ? "right" : "left"] = true;
                clearTimeout(args.timeout.id);
                args.timeout.id = null;
            }
            tetresse.listeners.binds.pause({keyCode: args.keyCode});
            tetresse.listeners.binds.resume({keyCode: args.keyCode, onKeyDown: !args.keyDown, onKeyUp: args.keyDown});
        };
        var leftRightState = {left: false, right: false};
        for (var i = 0; i < arr.length; i++) {
            var v = arr[i];
            v.args = v.args == null ? {} : v.args;
            v.args.game = this
            v.args.i = v.i;
            v.args.delay = v.delay;
            v.args.firstDelay = v.firstDelay;

            var f = {a: null};
            var timeout = {id: null};
            if (v.funcLabel == "left" || v.funcLabel == "right") {
                v.func = arrKeyLeftRight;
                v.args.keyCode = v.keyCode;
                v.args.keyDown = true;
                v.args.active = f;
                v.args.state = leftRightState;
                v.args.label = v.funcLabel;
                v.args.timeout = timeout;
                k.add(v);
                v.args = {game: this, i: v.i, keyDown: false, keyCode: v.keyCode, 
                    active: f, state: leftRightState, label: v.funcLabel, timeout: timeout};
                v.args.keyDown = false;
                v.onKeyDown = false;
                v.onKeyUp = true;
                k.add(v);
            } else {
                v.func = arrKey;
                v.args.keyCode = v.keyCode;
                v.args.keyDown = true;
                v.args.timeout = timeout;
                k.add(v);
                v.args = {game: this, i: v.i, keyDown: false, keyCode: v.keyCode, active: f, timeout: timeout};
                v.args.keyDown = false;
                v.onKeyDown = false;
                v.onKeyUp = true;
                k.add(v);
            }
        }
    }

    // default actions: (0: left, 1: right, 2: hd, 3: sd, 4: cw, 5: ccw, 6: hold, 7: 180)
    setupActions() {
        this.actions.add({func: function(args) {
            // console.log("left");
            args.game.piece.move(-1);
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("right");
            args.game.piece.move(1);
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("harddrop");
            args.game.piece.hardDrop();
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("softdrop");
            args.game.piece.drop();
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("rotate cw");
            args.game.piece.rotate(1);
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("rotate ccw");
            args.game.piece.rotate(-1);
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            // console.log("hold");
            args.game.piece.hold();
        }, args: {game: this}});
        this.actions.add({func: function(args) {
            console.log("rotate 180");
        }, args: {game: this}});
    }

    /**
     * Creates the actions object for this game.
     * add(args):
     *   args:
     *     {func, (args), (i), (label)}
     *         saves func and assigns it to an action but does not add it to the queue
     *     - func: function to add
     *     - args: arguments to put in the function when called
     *     - i: next in series by default, force this func to index (num or string), note overwriting can mess up recordings TODO fix this
     *     - label: null by default, label points to i assigned function
     *     {label}: adds label to queue
     *     {i}: adds i to queue
     *     {i, label}: links label with i
     *   returns: object with index that will always point to where element is stored {i: 123}
     * pause(): pauses execution, actions may still be added to queue
     * resume(): resumes execution
     * clear(): clears buffer
     * remove(args)
     */
    createActions() {
        var actions = {
            game: this,
            buffer: [], // element: {action}
            table: {index: {i: -1}, labels: {}}, // {index[i]: {func, args}, labels[label]: i, ref: {i}}
            active: true,
            running: false, // if there is a thread going through buffer
            add(args) { // {func, args, i, label}
                if (args == null) return; // TODO reportError
                if (args.i == "i") args.i = "-i";

                if (args.func != null) { // add new function
                    if (args.i != null) {
                        if (this.table.index[args.i] != null) {
                            this.table.index[args.i].ref[i] = ++this.table.index.i;
                            // TODO reportError (collision)
                        }
                    }
                    args.i = args.i == null ? ++this.table.index.i : args.i;
                    this.table.index[args.i] = {func: args.func, args: args.args, labels: {}, ref: {i: args.i}};
                    if (args.label != null) {
                        this.table.labels[args.label] = args.i;
                        this.table.index[args.i].labels[args.label] = args.label;
                        // TODO reportError (collision) if overwriting a label
                    }
                    return this.table.index[args.i].ref;
                }
                if (args.label != null && args.i != null) {
                    if (this.table.index[args.i] == null) return; // TODO reportError
                    this.table.labels[args.label] = args.i
                    this.table.index[args.i].labels[args.label] = args.label;
                    return;
                }
                if (args.i != null) {
                    if (this.table.index[args.i] == null) return; // TODO reportError
                    this.buffer.push(this.table.index[args.i].ref);
                }
                if (args.label != null) {
                    if (this.table.labels[args.label] == null || this.table.index[this.table.labels[args.label]] == null) return // TODO reportError
                    this.buffer.push(this.table.index[this.table.labels[args.label]].ref);
                }
                this.func();
            },
            pause() {
                this.paused = true;
            },
            resume() {
                this.paused = false;
                this.func();
            },
            clear() {
                this.buffer = [];
            },
            remove(args) { // args: {amount} (removes amount) TODO add remove i / label and add documentation
                this.buffer.splice(0, args.amount == null ? 1 : args.amount);
            },
            func() {
                if (this.running)
                    return;
                this.running = true;
                while (this.buffer.length != 0 && !this.paused) {
                    var v = this.buffer.splice(0, 1)[0];
                    v = this.table.index[v.i];
                    if (v.func(v.args))
                        this.game.listeners.execute("action", v.i);
                }
                this.running = false;
            },
        };
        return actions;
    }

    /**
     * Creates the listeners object for this game. All methods must be called from listeners scope (eg. listeners.add({...}))
     * add(event, (func), (args), (awake)): adds events and or functions
     *   event: event label, used to call when executed
     *   func: function to run when event executes
     *   args: arguments for the function
     *   awake: true by default, only matters when adding a new event
     *   returns: hash of function and args used to identify, or null if func was not added
     * execute(event, args): executes an event
     *   event: executes all functions linked with this event
     * pause(args): listeners or specific event
     *   args:
     *     {event}: pauses specific event
     *     {all}: if true pauses all individual events
     *     null: pauses entire eventListener and saves state
     * resume(args): resumes listeners or specific event
     *   args:
     *     {event}: resumes specific event
     *     null: resumes entire eventListener from paused state
     * remove(args): removes event(s) with attached functions
     *   args:
     *     {event}: removes specific event with functions
     *     null: removes all events and functions
     * list(args)
     */
    setupListeners() {
        var listeners = {
            active: true,
            events: {}, // [event]: {awake: true, funcs: {id}}}
            funcs: {i: -1}, // [id] {func, args, events: {event}}
            clock: {
                game: this,
                tick: 100, // tick time (in ms)
                count: 0, // number of ticks that have passed
                running: false,
                func: function(game) { // this game's listeners 
                    game.listeners.execute("tick");
                    game.listeners.clock.count++;
                    var v = game.listeners.clock;
                    window.setTimeout(v.func, v.tick, game);
                },
                pause() {
                    if (!this.running) return;
                    clearTimeout(this.func);
                    running = false;
                },
                resume() {
                    if (this.running) return;
                    window.setTimeout(this.func, this.tick, this.game);
                    this.running = true;
                },
                reset() {
                    pause();
                    this.count = 0;
                }
            },
            add(event, func, args, awake) { // args: {event, func, args, awake}
                if (event == null) return; // TODO reportError
                awake = awake == null ? true : awake;
                if (this.events[event] == null) // add new event
                    this.events[event] = {awake: awake, funcs: {}};
                if (func != null) { // add func
                    this.funcs[++this.funcs.i] = {func: func, args: args, events: {[event]: event}}
                    this.events[event].funcs[this.funcs.i] = this.funcs.i;
                    return this.funcs.i;
                }
                return null;
            },
            execute(event, args) { // args: {event, [args]} TODO add args to documentation, passes value through to func from caller of execute
                if (event == null) return; // TODO reportError
                if (this.events[event] == null) return; // TODO reportError
                if (!this.events[event].awake) return;
                for (var v in this.events[event].funcs)
                    this.funcs[v].func(this.funcs[v].args, args);
            },
            pause(args) { // {event, all}
                if (args == null) {
                    this.awake = false;
                    return;
                }
                if (args.event != null && this.events[args.event] != null)
                    this.events[args.event].awake = false;
                if (args.all != null && args.all)
                    for (var v in this.events)
                        this.events[v].awake = false;
            },
            resume(args) { // {event}
                if (args == null) {
                    this.awake = true;
                    return;
                }
                if (args.event != null && this.events[args.event] != null)
                    this.events[args.event].awake = true;
            },
            remove(args) { // {event}
                if (args == null) {
                    for (var v in this.events) {
                        for (var u in v.funcs)
                            this.funcs[u] = null;
                        v = null;
                    }
                    this.funcs.i = -1;
                }
                if (args.event != null && this.events[args.event] != null) {
                    for (var v in this.events[args.event])
                        this.funcs[v] = null
                }
            },
            list(args) { // TODO

            }
        };

        return listeners;
    }

    /**
     * sets up the piece component of the game
     */
    setupPiece() {
        var piece = {
            game: this,
            cur: {
                p: null,
                loc: {}, // location of the top left of piece layout's location
                rot: 0,
                arr: null, // arrangment of this piece (default layout but rotated)
                kick: false, // whether piece was last kicked when rotated
                gravity: 0 // number of times moved / rotated since last drop
            },
            held: {p: null, used: false},
            upNext: [],
            gravity: {
                game: this,
                func: null,
                setState(state) { // true to activate, false to pause
                    if (state == (this.func != null)) return;
                    if (state) {
                        this.func = {
                            f: function(args) {
                                if (args.game.piece.gravity.func == null) return;
                                if (args.game.piece.cur.p != null && !args.game.piece.drop()) 
                                    if (!args.game.settings.replay) args.game.piece.place();
                            },
                            args: {
                                game: this.game,
                                time: this.game.settings.game.play.gravity.speed,
                                func: this.func
                            },
                            stall: this.game.settings.game.play.gravity.stall,
                            timeout: null
                        };
                        this.reset(true);
                    } else {
                        clearTimeout(this.func);
                        this.func = null;
                    }
                },
                reset(ignore) { // restarts this gravity's timer, ignore count or not
                    ignore = ignore == null ? false : ignore;
                    if (this.func == null) return;
                    if (!ignore && this.func.stall < this.game.piece.cur.gravity++) return;
                    if (this.func.timeout != null) clearTimeout(this.func.timeout);
                    this.func.timeout = window.setTimeout(this.func.f, this.func.args.time, this.func.args);
                }
            },
            move(amount) { // positive for right, negative for left. Will move as much as possible. Returns amount piece moved. displays and executes listeners by default
                var e = this.game.listeners; var t = "move";
                var a = this.canShift(amount);
                if (a != 0) e.execute(t);   
                this.cur.loc.c += a;
                if (a == 0) {
                    e.execute(t += "Attempted");
                    if (amount > 0) e.execute(t + "Right"); else e.execute(t + "Left");
                } else {
                    this.cur.kick = false;
                    if (this.canDrop(1) == 1) this.gravity.reset();
                    e.execute(t += "d");
                    if (amount > 0) e.execute(t += "Right"); else e.execute(t += "Left");
                    if (a > 1) {e.execute("movedMultiple"); e.execute(t + "Multiple");}
                }
            },
            rotate(amount) { // rotates piece by amount then checks (180 rotation will not check validity of rotating 90 degrees)
                var e = this.game.listeners; var t = "rotate"; e.execute(t);
                var amountCW = (amount + 4) % 4; // number of times cw
                var a = this.canRotate(amount);
                if (a == null) {
                    e.execute(t + "Attempted");
                    e.execute(t + "Attempted" + (amountCW == 1 ? "CW" : amountCW == 3 ? "CCW" : "180"));
                    return;
                }
                this.cur.kick = this.cur.loc.r != a.loc.r || this.cur.loc.c != a.loc.c;
                this.cur.loc = a.loc; this.cur.arr = a.arr; this.cur.rot = (this.cur.rot + amountCW) % 4;
                if (this.canDrop(1) == 1) this.gravity.reset();
                e.execute(t += "d");
                e.execute(t + (amountCW == 1 ? "CW" : amountCW == 3 ? "CCW" : "180"));
                if (this.cur.kick) {
                    e.execute("kicked");
                    e.execute("kicked-" + this.cur.p)
                } else
                    e.execute("notKicked");
                return;
            },
            drop() { // (soft) drops down one space
                var d = this.canDrop(1);
                if (d == 1) this.game.listeners.execute("drop");
                if (d) this.cur.loc.r++;
                else {this.game.listeners.execute("dropAttempted"); return false;}
                this.gravity.reset(true);
                this.game.listeners.execute("dropped");
                return true;
            },
            hardDrop() {
                this.game.listeners.execute("harddrop");
                var amount = this.canDrop();
                this.cur.loc.r += amount;
                this.place();
                this.game.listeners.execute("harddropped");
            },
            place() { // place the piece on the board (does not drop)
                this.game.listeners.execute("place");
                var updatedArr = [];
                for (var r = 0; r < this.cur.arr.length; r++)
                    for (var c = 0; c < this.cur.arr[0].length; c++) {
                        var br = this.cur.loc.r;
                        var bc = this.cur.loc.c;
                        var mr = this.game.board.length;
                        var mc = this.game.board[0].length;
                        if (this.cur.arr[r][c] != 0) {
                            this.game.board[r + br][c + bc].content = this.cur.p;
                            updatedArr.push({r: r + br, c: c + bc, content: this.cur.p});
                        }
                    }
                this.held.used = false;
                var l = this.game.listeners;
                l.execute("placed", updatedArr);
                if (!this.canMove()) {
                    l.execute("spin");
                    l.execute(this.cur.p + "-spin");
                }
            },
            next(cur) { // cur: null (pulls from top of next array), {p} generates loc and rot, {p, loc, rot}
                // add to next if there are not enough pieces TODO add setting to take in stream?
                if (this.upNext.length < 7) {
                    var bag = tetresse.utils.shuffle(["i", "j", "l", "o", "s", "t", "z"]);
                    this.upNext.push.apply(this.upNext, bag);    
                    this.game.listeners.execute("updatedBag", this.cur.p);
                }
                var generatedNext = cur == null;
                if (cur == null) // TODO reportError when piece isn't valid?
                    cur = {p: this.upNext.splice(0, 1)[0]};
                this.cur.p = cur.p;
                if (cur.loc == null)
                    cur.loc = {
                        r: tetresse.utils.piece.spawnLoc[this.cur.p][0] + this.game.settings.game.board.hiddenRows,
                        c: tetresse.utils.piece.spawnLoc[this.cur.p][1]
                    };
                if (cur.rot == null)
                    cur.rot = 0;
                this.cur.loc = cur.loc;
                this.cur.rot = cur.rot;
                this.cur.arr = tetresse.utils.piece.layout[this.cur.p];
                this.cur.kick = false;
                this.cur.gravity = 0;
                this.gravity.reset(true);
                tetresse.utils.rotate(this.cur.arr, this.cur.rot);
                this.game.listeners.execute("spawned", this.cur.p);
                if (generatedNext)
                    this.game.listeners.execute("next");
            },
            get(type) { // type: null (returns copy of {cur, loc, rot}), "v" (returns {loc, arr})
                if (type == null) return {p: this.cur.p, loc: {r: this.cur.loc.r, c: this.cur.loc.c}, rot: this.cur.rot};
                if (type === "v") return {loc: {r: this.cur.loc.r, c: this.cur.loc.c}, arr: this.cur.arr};
            },
            canMove(deltaR, deltaC) { // checks validity of r + deltaR (positive is down) and c + deltaC (positive is right)
                if (deltaR == null) deltaR = 0;
                if (deltaC == null) deltaC = 0;
                if (deltaR == 0 && deltaC == 0)
                    return this.canMove(1) || this.canMove(-1) || this.canMove(0, 1) || this.canMove(0, -1);
                
                var test = this.get("v");
                test.loc.r += deltaR; // TODO test these out individually using other methods (canShift and canDrop)
                test.loc.c += deltaC;
                return this.isValid(test);
            },
            canShift(amount) { // left (negative) or right (positive), returns amount able to be moved (<= amount specified)
                if (amount == null) return; // TODO reportError (or add functionality)
                var a = amount / Math.abs(amount);
                var t = this.get("v");
                var i = 0;
                while (i < Math.abs(amount)) {
                    t.loc.c += a;
                    if (!this.isValid(t)) break;
                    i++;
                }
                return i * a;
            },
            hold() {
                var l = this.game.listeners;
                if (this.held.used) { 
                    l.execute("attemptedHold");
                    return;
                }
                l.execute("hold");
                if (this.held.p == null) {
                    this.held.p = this.cur.p;
                    this.next();
                } else {
                    var temp = this.cur.p
                    this.next({p: this.held.p});
                    this.held.p = temp;
                }
                this.held.used = true;
                l.execute("held");
            },
            isValid(piece) { // piece: {loc, arr}, null (checks current piece)
                if (piece == null) piece = {loc: this.cur.loc, arr: this.cur.arr};
                for (var r = 0; r < piece.arr.length; r++) {
                    for (var c = 0; c < piece.arr[0].length; c++) {
                        if (piece.arr[r][c] != 1) continue;
                        var b = this.game.board;
                        var rr = r + piece.loc.r;
                        var cc = c + piece.loc.c;
                        // check bounderies. Note: does not check if row is above board, however will return false if there is overlap in default spawn loc
                        if (rr >= b.length || cc >= b[0].length || cc < 0) return false;
                        // check if tile is empty
                        if (b[rr][cc].content !== "") return false;
                    }
                }
                return true;
            },
            canRotate(amount) { // whether it can rotate the amount (positive is cw), 0 is can't rotate. returns {arr, loc{x, y}} or null if impossible
                var t = this.get("v");
                var amountCW = (amount + 4) % 4; // number of times cw
                var rt = this.cur.p == "i" ? "i" : "default";
                var multiplier = amountCW == 3 ? -1 : 1; // for clockwise
                var rotNum = amountCW == 1 ? this.cur.rot : (this.cur.rot + 3) % 4; // target rotation state, eg state = 2 and amount = 3, final state is 1

                t.arr = tetresse.utils.rotate(t.arr, amount);
                t.iLoc = {r: t.loc.r, c: t.loc.c};
                var possible = false;
                for (var i = 0; i < tetresse.utils.piece.rotationChart[rt][rotNum].length; i++) {
                    t.loc.r = t.iLoc.r + (-1) * tetresse.utils.piece.rotationChart[rt][rotNum][i][1] * multiplier;
                    t.loc.c = t.iLoc.c + tetresse.utils.piece.rotationChart[rt][rotNum][i][0] * multiplier;
                    if (this.isValid(t)) return {arr: t.arr, loc: {r: t.loc.r, c: t.loc.c}};
                }
                return null;
            },
            canDrop(amount) { // checks if piece can be dropped that amount, or null to count max. Returns amount successfully dropped
                var t = this.get("v");
                var i = 0;
                while (amount == null || i < amount) {
                    t.loc.r++;
                    if (!this.isValid(t)) break;
                    i++;
                }
                return i;
            }
        };
        this.listeners.add("startGame",
            function(args) {
                if (!args.game.settings.replay)
                    args.game.piece.next();
                args.game.piece.gravity.setState(args.game.settings.game.play.gravity.enabled);
            }, {game: this});
        return piece;
    }

    createBoard() {
        var board = [];
        for (var r = 0; r < this.settings.game.board.shownRows + this.settings.game.board.hiddenRows; r++) {
            board[r] = [];
            for (var c = 0; c < this.settings.game.board.cols; c++) {
                board[r][c] = {content: ""};
            }
        }
        return board;
    }

    /**
     * sets up the listeners that control the display
     */
    initializeDisplay() {
        // move
        this.listeners.add("move", this.display.update, {type: "boardPiece", show: false, display: this.display});
        this.listeners.add("moved", this.display.update, {type: "boardPiece", display: this.display});
        // rotate
        this.listeners.add("rotate", this.display.update, {type: "boardPiece", show: false, display: this.display});
        this.listeners.add("rotated", this.display.update, {type: "boardPiece", display: this.display});
        // sd
        this.listeners.add("drop", this.display.update, {type: "boardPiece", show: false, display: this.display});
        this.listeners.add("dropped", this.display.update, {type: "boardPiece", display: this.display});
        // hd
        this.listeners.add("harddrop", this.display.update, {type: "boardPiece", show: false, display: this.display});
        this.listeners.add("placed", this.display.update, {type: "boardPiece", display: this.display});
        if (!this.settings.replay) {
            // hold
            this.listeners.add("hold", this.display.update, {type: "boardPiece", show: false, display: this.display});
            this.listeners.add("held", this.display.update, {type: "holdPiece", display: this.display});
            // up next
            this.listeners.add("next", this.display.update, {type: "next", display: this.display, border: false});
        }
        // spawn
        this.listeners.add("spawned", this.display.update, {type: "boardPiece", display: this.display});
    }

    /**
     * canvas - canvas to draw on.
     * lx, ly - percentage of canvas coordinates for drawing the top left corner of the board
     * mw, mh - maximum width and height percentage with respect to canvas
     * note: x, y, w, h are all set to percentages based on canvas size if not already percentages.
     * note: x, y, w, h by default are set to fill canvas with peripherals on left and right
     */
    createDisplay() {
        var td = tetresse.display;
        var ds = this.settings.game.display;
        Tetresse.setupResize();
        var display = {
            id: -1, // index in tetresse.listeners.resize.list
            ctx: td.canvas.getContext("2d"),
            locX: ds.x,
            locY: ds.y,
            x: null, // percentage of canvas width to top right of board
            y: null, // ...
            maxW: ds.width, // max width of the board in percentage with respect to canvas
            maxH: ds.height, // ...
            whRatio: 3 / 2,
            w: null, // width of the board
            h: null, // ...
            paused: false, // whether or not to draw stuff
            game: this,
            /**
             * Redraws all of this board.
             * args {
             *   type: method to call (see display.methods for options)
             *   display: this display (optional)
             *   x, y: coordinates (optional)
             *   r1, r2: row1 (inclusive) through row2 (exclusive) (optional) used in boardContent
             *       the 0 row is the top-most row of the board (hidden)
             *   show: whether to show or hide (true by default)
             * }
             */
            update(args) {
                if (args == null) args = {type: "refresh"};
                if (args.length != null) args = {type: args};
                if (args.display == null) args.display = this;
                args.display.methods[args.type](args);
            },
            methods: { // Should only be called from update method.
                refresh(args) { // redraws this entire game, use when w, h, x, or y need to be updated
                    var td = tetresse.display.canvas
                    var xy = {x: td.width * args.display.locX, y: td.height * args.display.locY};
                    var wh = tetresse.utils.displaySize(td.width, td.height, args.display.maxW, args.display.maxH, args.display.whRatio);
                    var t = wh.w / 15;
                    args.display.x = xy.x + (t / 2 + 2 * t); args.display.y = xy.y + t / 4;
                    args.display.w = wh.w * (2 / 3); args.display.h = wh.h - (t / 2);
                    this.board(args);
                    if (!args.display.game.settings.replay)
                        this.peripherals(args);
                },
                board(args) { // redraws the board
                    this.boardContent(args);
                    this.boardPiece(args);
                    this.boardBorder(args);
                }, 
                boardContent(args) { // redraws the board's contents
                    var d = args.display;
                    var mr = args.display.game.settings.game.board.shownRows;
                    var mc = args.display.game.settings.game.board.cols;
                    var hr = d.game.board.length - mr;
                    var hc = d.game.board[0].length - mc;
                    var cx = d.x;
                    var cy = d.y;
                    var cw = d.w;
                    var ch = d.h;
                    for (var r = (args.r1 == null ? 0 : args.r1 - hr); r < (args.r2 == null ? mr : args.r2 - hr); r++) {
                        for (var c = 0; c < mc; c++) {
                            // d.ctx.beginPath();
                            // d.ctx.rect(cx + (cw / mc) * c, cy + (ch / mr) * r, cw / mc, ch / mr);
                            // d.ctx.lineWidth = 2;
                            // d.ctx.strokeStyle = "grey";
                            // d.ctx.stroke();

                            args.r = r;
                            args.c = c;
                            args.content = d.game.board[hr + r][hc + c].content;
                            this.tile(args);
                        }
                    }
                },
                boardBorder(args) { // redraws the board's border. note: erases piece
                    var d = args.display;
                    var v = {x: d.x, y: d.y, w: d.w, h: d.h};
                    var offset = d.w / 40;
                    // if the display doesn't update correctly (some parts update before others) change this to rect and implement an extra function at the end of tetresse.listeners.resize.list
                    d.ctx.beginPath();
                    d.ctx.rect(v.x - offset, v.y - offset, v.w + 2 * offset, v.h + 2 * offset);
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "grey";
                    d.ctx.fill("evenodd");
                },
                boardPiece(args) { // redraws the board's piece, uses args.show
                    var d = args.display;
                    if (d.game.piece == null) return;
                    var p = d.game.piece.cur;
                    if (p == null || p.p == null) return;
                    this.boardPieceGhost(args);
                    args.show = args.show == null ? true : args.show;
                    if (p == null) return;
                    for (var r = 0; r < p.arr.length; r++)
                        for (var c = 0; c < p.arr.length; c++)
                            if (p.arr[r][c] != 0) {
                                args.r = r + p.loc.r - d.game.settings.game.board.hiddenRows;
                                args.c = c + p.loc.c;
                                args.content = args.show ? p.p : null;
                                this.tile(args);
                            }
                },
                boardPieceGhost(args) { // redraws ghost piece, uses args.show
                    var d = args.display;
                    if (d.game.piece == null)
                        return;
                    args.show = args.show == null ? true : args.show;
                    var p = d.game.piece.cur;
                    args.content = args.show ? "ghost" : null;
                    var dropRows = d.game.piece.canDrop();
                    for (var r = 0; r < p.arr.length; r++)
                        for (var c = 0; c < p.arr.length; c++)
                            if (p.arr[r][c] != 0) {
                                args.r = r + p.loc.r - d.game.settings.game.board.hiddenRows + dropRows;
                                args.c = c + p.loc.c;
                                this.tile(args);
                            }
                },
                peripherals(args) { // redraws the peripherals
                    this.hold(args);
                    this.next(args);
                },
                hold(args) {
                    this.holdBorder(args);
                    this.holdPiece(args);
                },
                holdBorder(args) {
                    var d = args.display;
                    var v = {x: d.x, y: d.y, w: d.w, h: d.h};
                    v = {x: v.x - v.w / 40 - v.w / 5, y: v.y + 2.5 * v.h / 20, w: v.w / 5, h: v.h / 10};
                    var offset = d.w / 40;
                    d.ctx.beginPath();
                    d.ctx.rect(v.x - offset, v.y - offset, v.w + 2 * offset, v.h + 2 * offset);
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "grey";
                    d.ctx.fill("evenodd");
                },
                holdPiece(args) {
                    var d = args.display;
                    // background
                    var v = {x: d.x, y: d.y, w: d.w, h: d.h};
                    v = {x: v.x - v.w / 40 - v.w / 5, y: v.y + 2.5 * v.h / 20, w: v.w / 5, h: v.h / 10};
                    d.ctx.beginPath();
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "black";
                    d.ctx.lineWidth = 1;
                    d.ctx.fill();

                    if (d.game.piece == null || d.game.piece.held.p == null)
                        return;
                    var p = d.game.piece.held.p;
                    var l = tetresse.utils.piece.layout[p];
                    var color = {i: "hsl(196, 89%, 57%)", j: "hsl(231, 69%, 45%)", l: "hsl(24, 98%, 44%)", o: "hsl(42, 97%, 45%)", s: "hsl(92, 91%, 37%)", t: "hsl(314, 63%, 41%)", z: "hsl(348, 86%, 45%)", null: "black"};
                    v = {x: v.x + (p == "i" ? 0 : (p == "o" ? v.w * (1/4) : v.w * (1/8))), 
                        y: v.y + (p == "i" ? v.w * (1/8) : v.w * (1/4)), 
                        w: v.w / 4, h: v.h / 4};
                    for (var r = 0; r < l.length; r++)
                        for (var c = 0; c < l[0].length; c++)
                            if (l[r][c] == 1) {
                                d.ctx.beginPath();
                                d.ctx.rect(v.x + v.w * c, v.y + v.h * r, v.w, v.h);
                                d.ctx.fillStyle = color[p];
                                d.ctx.fill();
                            }
                },
                next(args) { // args.num is the next piece to update (or null for updating all), args.border to updated border too (true by default)
                    var n;
                    args.border = args.border == null ? true : args.border;
                    if (args.border) this.nextBorder(args);
                    if (args.num == null) {
                        for (var i = 0; i < args.display.game.settings.game.display.nextPieces; i++) {
                            args.num = i;
                            this.nextPiece(args);
                        }
                        args.num = null;
                    } else {
                        this.nextPiece(args);
                    }
                },
                nextPiece(args) { // args.num is the piece to be updated, starting at 0
                    var d = args.display;
                    // background
                    var v = {x: d.x, y: d.y, 
                        w: d.w, h: d.h};
                    v = {x: v.x + v.w / 40 + v.w, y: v.y + 2.5 * v.h / 20, w: v.w / 5, 
                        h: v.w / 5};
                    var offset = d.w / 80;
                    v.y += offset * (args.num) + offset * (args.num == 0 ? 0 : 1) + v.h * args.num;

                    d.ctx.beginPath();
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "black";
                    d.ctx.lineWidth = 1;
                    d.ctx.fill();

                    if (args.display.game.piece == null)
                        return;
                    var p = d.game.piece.upNext[args.num];
                    var l = tetresse.utils.piece.layout[p];
                    var color = {i: "hsl(196, 89%, 57%)", j: "hsl(231, 69%, 45%)", l: "hsl(24, 98%, 44%)", o: "hsl(42, 97%, 45%)", s: "hsl(92, 91%, 37%)", t: "hsl(314, 63%, 41%)", z: "hsl(348, 86%, 45%)", null: "black"};
                    v = {x: v.x + (p == "i" ? 0 : (p == "o" ? v.w * (1/4) : v.w * (1/8))), 
                        y: v.y + (p == "i" ? v.w * (1/8) : v.w * (1/4)), 
                        w: v.w / 4, h: v.h / 4};
                    for (var r = 0; r < l.length; r++)
                        for (var c = 0; c < l[0].length; c++)
                            if (l[r][c] == 1) {
                                d.ctx.beginPath();
                                d.ctx.rect(v.x + v.w * c, v.y + v.h * r, v.w, v.h);
                                d.ctx.fillStyle = color[p];
                                d.ctx.fill();
                            }
                },
                nextBorder(args) { // includes the divider between next[0] and next[1]
                    var d = args.display;
                    var v = {x: d.x, y: d.y, w: d.w, h: d.h};
                    v = {x: v.x + v.w / 40 + v.w, y: v.y + 2.5 * v.h / 20, w: v.w / 5, h: (v.h / 10 + v.h / 80) * args.display.game.settings.game.display.nextPieces - v.h / 80};
                    var offset = d.w / 40;
                    d.ctx.beginPath();
                    d.ctx.rect(v.x - offset, v.y - offset, v.w + 2 * offset, v.h + 2 * offset);
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "grey";
                    d.ctx.fill("evenodd");
                    v.h = d.h / 10;
                    d.ctx.beginPath();
                    d.ctx.rect(v.x - offset, v.y - offset, v.w + 2 * offset, v.h + 2 * offset);
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = "grey";
                    d.ctx.fill("evenodd");
                },
                tile(args) { // args.content is the piece, args.c and args.r include 0 (top left is 0, 0)
                    if (args.r == null || args.c < 0 || args.c >= args.display.game.board.length
                        || args.r < 0) return;
                    var d = args.display;
                    args.content = args.content == null || args.content == "" ? "null" : args.content;
                    var c = {i: "hsl(196, 89%, 57%)", j: "hsl(231, 69%, 45%)", l: "hsl(24, 98%, 44%)", o: "hsl(42, 97%, 45%)", s: "hsl(92, 91%, 37%)", t: "hsl(314, 63%, 41%)", z: "hsl(348, 86%, 45%)", null: "black", ghost: "#484848"};
                    var v = {x: d.x, y: d.y, w: d.w, h: d.h};
                    v = {x: v.x + args.c * v.w / 10, y: v.y + args.r * v.h / 20, w: v.w / 10, h: v.h / 20};
                    d.ctx.beginPath();
                    d.ctx.rect(v.x, v.y, v.w, v.h);
                    d.ctx.fillStyle = c[args.content];
                    d.ctx.strokeStyle = c[args.content];
                    d.ctx.lineWidth = 1;
                    d.ctx.fill();
                    d.ctx.stroke();
                    if (args.content == "null") {
                        d.ctx.beginPath();
                        d.ctx.rect(v.x, v.y, v.w, v.h);
                        d.ctx.lineWidth = 1;
                        d.ctx.strokeStyle = "grey";
                        d.ctx.stroke();
                    }
                }
            }
        };
        display.update({type: "refresh", display: display});
        tetresse.display.add(this.id, display)
        return display;
    }

    // Creates tetresse variable
    static envSetup() {
        if (window.tetresse == null)
            window.tetresse = {
                games: [],
                utils: {
                    shuffle(arr) { // Fisher-Yates shuffle
                        var m = arr.length, t, i;
                        while (m) {
                            i = Math.floor(Math.random() * m--);
                            t = arr[m];
                            arr[m] = arr[i];
                            arr[i] = t;
                        }
                        return arr;
                    },
                    rotate(arr, amount, generate) { // amount: null (rotates cw 90 degrees). generate: null (default of true), false (manipulates array)
                        // TODO implement generate
                        if (arr.length != arr[0].length) return; // TODO reportError
                        if (amount == null)
                            amount = 1;
                        amount = (amount % 4 + 4) % 4; // -5: 3, -4: 0, -3: 1, -2: 2, -1: 3, 0: 0, 1: 1, 2: 2, 3: 3, 4: 0, 5: 1... 

                        var newArr = [];
                        for (var r = 0; r < arr.length; r++) {
                            var temp = [];
                            for (var c = 0; c < arr[0].length; c++) {
                                temp.push(arr[r][c]);
                            }
                            newArr.push(temp);
                        }

                        var rotateCW = function(arr) {
                            // reverse the rows
                            for (var i = 0; i < arr.length / 2; i++) {
                                var temp = [];
                                for (var j = 0; j < arr[i].length; j++)
                                    temp.push(arr[i][j]);
                                arr[i] = arr[arr.length - 1 - i];
                                arr[arr.length - 1 - i] = temp;
                            }
                            // swap the symmetric elements
                            for (var i = 0; i < arr.length; i++) {
                                for (var j = 0; j < i; j++) {
                                    var temp = arr[i][j];
                                    arr[i][j] = arr[j][i];
                                    arr[j][i] = temp;
                                }
                            }
                            return arr;
                        };

                        for (var i = 0; i < amount; i++)
                            rotateCW(newArr);

                        return newArr;
                    },
                    piece: {
                        rotationChart: { // for ccw, multiply by -1, [x, y], for reverse transformations, multiply by -1
                            default: [
                                [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]], // 0>>1
                                [[0,0], [1,0], [1,-1], [0,2], [1,2]], // 1>>2
                                [[0,0], [1,0], [1,1], [0,-2], [1,-2]], // 2>>3
                                [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]] // 3>>0
                            ],
                            i: [
                                [[0,0], [-2,0], [1,0], [-2,-1], [1,2]], // 0>>1
                                [[0,0], [-1,0], [2,0], [-1,2], [2,-1]], // 1>>2
                                [[0,0], [2,0], [-1,0], [2,1], [-1,-2]], // 2>>3
                                [[0,0], [1,0], [-2,0], [1,-2], [-2,1]] // 3>>0
                            ]
                        },
                        layout: {
                            "i": [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
                            "j": [[1,0,0],[1,1,1],[0,0,0]],
                            "l": [[0,0,1],[1,1,1],[0,0,0]],
                            "o": [[1,1],[1,1]],
                            "s": [[0,1,1],[1,1,0],[0,0,0]],
                            "t": [[0,1,0],[1,1,1],[0,0,0]],
                            "z": [[1,1,0],[0,1,1],[0,0,0]]},
                        spawnLoc: {"i": [-1,3], "j": [0,3], "l": [0,3], "o": [0,4], "s": [0,3], "t": [0,3], "z": [0,3]},
                    },
                    addEvent(element, eventName, callback) { // add listener
                        if (element.addEventListener) {
                            element.addEventListener(eventName, callback, false);
                        } else if (element.attachEvent) {
                            element.attachEvent("on" + eventName, callback);
                        } else {
                            element["on" + eventName] = callback;
                        }
                    },
                    removeEvent(element, eventName, callback) { // remove listener TODO add support for other browsers
                        element.removeEventListener(eventName, callback);
                    },
                    displaySize(availWidth, availHeight, maxWidth, maxHeight, ratio) { // calculates {w, h} so that ratio (h / w) is preserved
                        var width = availWidth * maxWidth;
                        if (maxHeight * availHeight < width * ratio)    
                            width = availHeight * maxHeight * (1 / ratio);
                        return {w: width, h: width * ratio};
                    }
                },
                listeners: {},
                modules: {}
            };
    }

    // Creates canvas
    static setupDisplay() {
        if (tetresse == null) Tetresse.envSetup();
        if (tetresse.display != null) return;
        if (tetresse.listeners.resize == null) Tetresse.setupResize();
        var c = document.createElement("canvas");
        document.body.appendChild(c);
        c.style = "background: black;display:block;margin:auto;";
        c.id = "tetresse-game-area"; 
        tetresse.display = {
            canvas: c,
            x: 0, // in percent
            y: 0, // in percent TODO make this a part of settings
            mw: 1, // max width constraint
            mh: 1, // max height constraint
            ratio: 1080 / 1920,
            children: {}, // full of display objects in games
            update() {
                var t = tetresse.display
                var s = tetresse.utils.displaySize(window.innerWidth, window.innerHeight, t.mw, t.mh, t.ratio);
                var c = tetresse.display.canvas;
                c.width = s.w;
                c.height = s.h;
                for (var v in tetresse.display.children) {
                    tetresse.display.children[v].update("refresh");
                }
            },
            add(id, display) {
                tetresse.display.children[id] = display;
            }
        };
        tetresse.listeners.resize.add("display", tetresse.display.update);
        tetresse.display.update();
    }

    // Creates tetresse resize variable
    static setupResize() {
        if (tetresse == null) Tetresse.envSetup();
        if (tetresse.listeners.resize != null) return;
        tetresse.listeners.resize = {
            active: false, 
            onResize: {}, // [label]: func, args
            // Pause drawing the screen
            pause() {
                if (tetresse.listeners.resize.active) {
                    tetresse.listeners.resize.active = false;
                    tetresse.utils.removeEvent(window, "resize", tetresse.listeners.resize.func);
                }
            },
            // Resume drawing the screen
            resume() {
                if (!tetresse.listeners.resize.active) {
                    tetresse.listeners.resize.active = true;
                    tetresse.utils.addEvent(window, "resize", tetresse.listeners.resize.func);
                }
            },
            add(label, func, args) {
                var onResize = tetresse.listeners.resize.onResize;
                if (onResize[label] != null) console.log("overwriting resize"); // TODO reportError
                onResize[label] = {func: func, args: args};
            },
            remove(label) {
                var onResize = tetresse.listeners.resize.onResize;
                if (onResize[label] == null) return false;
                return delete onResize[label];
            },
            // Executes func function in every element with specified args
            func() {
                var r = tetresse.listeners.resize.onResize;
                for (var v in r)
                    r[v].func(r[v].args);
            }
        };
    }

    /**
     * Creates tetresse keybinds variable which contains the following methods.
     * pause(args): pauses stuff, pause(null) does not prevent changing state of specific keyCodes
     *   args: 
     *     {keyCode, (onKeyDown), (onKeyUp)}
     *         pauses keyCode
     *     - keyCode: code returned by a key from js listener
     *     - onKeyDown: true by default, whether to pause onKeyDown
     *     - onKeyUp: true by default, whether to pause onKeyUp
     *     null
     *         pauses tetresse.listeners.bind process but saves which are active
     * resume(args): activates tetresse.listeners.binds or individual binds
     *   args:
     *     {keyCode, (onKeyDown), (onKeyUp)}
     *         resumes specific keyCode, note this does not start the process only changes the state
     *     - keyCode: code returned by a key from js listener
     *     - onKeyDown: true by default, whether to resume onKeyDown
     *     - onKeyUp: true by default, whether to resume onKeyUp
     *     null
     *         resumes tetresse.listeners.bind process from previous paused state
     * add(args): adds function and or keybind to listener
     *   args: 
     *     {keyCode, (keyCodeLabel), func, (funcLabel), (args), (onKeyDown), (onKeyUp)}
     *         adds function to keyCode (or label)
     *     - keyCode: code returned by onKeyDown / onKeyUp
     *     - keyCodeLabel: null by default, label of the keyCode, only used in list()
     *     - func: function to activate by keyCode
     *     - funcLabel: (i0, i1, ...) by default, label used to access the function later, "i" will be changed to "ii"
     *     - args: null by default, arguments to put in func when called
     *     - onKeyDown: true by default, activate func when key is pressed
     *     - onKeyUp: false by default, activate func when key is released
     *     {keyCode, (keyCodeLabel)}
     *         adds keyCode if new and updates label
     *     {func, (funcLabel), (args)}
     *         adds function with label and args
     *     {keyCode, funcLabel, (onKeyDown), (onKeyUp)}
     *         adds funcLabel to keyCode to active when keyCode
     *   returns: hash used for func - funcLabel if available, else first available of funcLabel0, funcLabel1, ...
     * remove(args): removes funcs from keyCodes
     *   args:
     *     {keyCode, funcLabel, (onKeyDown), (onKeyUp)}
     *         removes funcLabel from keyCode
     *     - keyCode: code recived from js keypress event
     *     - funcLabel: if specified just removes funcLabel from keyCode
     *     - onKeyDown: true by default, whether to remove stuff from onKeyDown
     *     - onKeyUp: true by default, whether to remove stuff from onKeyUp
     *     {funcLabel, (all), (onKeyDown), (onKeyUp)}
     *         removes funcLabel specified or just onKeyDown and or onKeyUp if specified
     *     - all: false by default, whether to remove all funcLabels in the same way (funcLabel must be specified)
     *     {keyCode, (onKeyDown), (onKeyUp)}
     *         removes keyCode specified or just onKeyDown and or onKeyUp if specified
     *     null
     *         removes all funcLabels not attached to anything, similar to garbage collect
     * list(args): lists different things such as keyCodes, funcs of a keyCode, etc TODO
     */ 
    static setupBinds() { // TODO combine pause and resume
        if (tetresse == null)
            Tetresse.envSetup();
        if (tetresse.listeners.binds != null)
            return;
        tetresse.listeners.binds = {
            active: false,
            interface: {}, // {keyDown, keyUp} used to remove listeners later
            binds: {}, // [keyCode]: {keyDown{i}, keyUp{i}, label, keyUpActive, keyDownActive}
            labels: {}, // [label]: {keyCode: keyCode}
            funcs: {i: -1}, // [i]: {func, keyDown{keyCode}, keyUp{keyCode}, args}
            pause(args) { // {keyCode, onKeyDown, onKeyUp}, null
                var k = tetresse.listeners.binds;
                if (args == null) {
                    if (!k.active) return;
                    k.active = false;
                    var u = tetresse.utils;
                    if (k.interface.keyUp != null) u.removeEvent(window, "keydown", k.interface.keyDown);
                    if (k.interface.keyDown != null) u.removeEvent(window, "keyup", k.interface.keyUp);
                    return;
                }
                if (args.keyCode != null) {
                    if (k.binds[args.keyCode] == null) return; // TODO reportError
                    args.onKeyDown = args.onKeyDown == null ? true : args.onKeyDown;
                    args.onKeyUp = args.onKeyUp == null ? true : args.onKeyUp;
                    if (args.onKeyDown)
                        k.binds[args.keyCode].keyDownActive = false;
                    if (args.onKeyUp)
                        k.binds[args.keyCode].keyUpActive = false;
                }
            },
            resume(args) { // {keyCode, onKeyDown, onKeyUp}, null
                var k = tetresse.listeners.binds; 
                if (args == null) { // set listeners
                    if (k.active) return;
                    k.active = true;
                    var u = tetresse.utils;
                    if (k.interface.keyUp != null) u.removeEvent(window, "keyup", k.interface.keyUp);
                    if (k.interface.keyDown != null) u.removeEvent(window, "keyup", k.interface.keyDown);
                    k.interface.keyUp = function(e) {
                        e = e || window.event;
                        var k = tetresse.listeners.binds;
                        if (k.binds[e.keyCode] == null) return;
                        if (k.binds[e.keyCode].keyUpActive)
                            for (var v in k.binds[e.keyCode].keyUp)
                                k.funcs[v].func(k.funcs[v].args);
                    };
                    k.interface.keyDown = function(e) {
                        e = e || window.event;
                        var k = tetresse.listeners.binds;
                        if (k.binds[e.keyCode] == null) return;
                        if (k.binds[e.keyCode].keyDownActive)
                            for (var v in k.binds[e.keyCode].keyDown)
                                k.funcs[v].func(k.funcs[v].args);
                    };
                    u.addEvent(window, "keyup", k.interface.keyUp);
                    u.addEvent(window, "keydown", k.interface.keyDown);
                    return;
                }
                if (args.keyCode != null) { // wake binds
                    if (k.binds[args.keyCode] == null) return; // TODO reportError
                    args.onKeyDown = args.onKeyDown == null ? true : args.onKeyDown;
                    args.onKeyUp = args.onKeyUp == null ? true : args.onKeyUp;
                    if (args.onKeyDown)
                        k.binds[args.keyCode].keyDownActive = true;
                    if (args.onKeyUp)
                        k.binds[args.keyCode].keyUpActive = true;
                }
            },
            add(args) { // {keyCode, keyCodeLabel, func, funcLabel, args, onKeyDown, onKeyUp}
                if (args == null) return; // TODO reportError
                var k = tetresse.listeners.binds;
                var hash = null;
                if (args.func != null) { // add func
                    // find next available hash: default are i + (index)
                    // if hash is taken, will be (funcHash) + (index): foo0, foo1, foo2...
                    if (args.funcHash == "i") args.funcHash = "-i";
                    hash = args.funcHash == null ? "i" + (++k.funcs.i) : args.funcHash;
                    if (k.funcs[hash] != null) hash += "0";
                    for (var i = 0; k.funcs[hash] != null; i++) hash = hash.splice(0, hash.length - ("" + i).length) + i; 

                    k.funcs[hash] = {keyDown: {}, keyUp: {}, func: args.func, args: args.args};    
                }
                if (args.keyCode != null) {
                    if (k.binds[args.keyCode] == null) // add new keyCode
                        k.binds[args.keyCode] = {keyDown: {}, keyUp: {}, keyDownActive: true, keyUpActive: true};
                    if (args.keyCode != null) // update label
                        k.binds[args.keyCode].label = args.keyCodeLabel;
                    if (hash != null) { // link hash with keyCode
                        args.onKeyDown = args.onKeyDown == null ? true : args.onKeyDown;
                        args.onKeyUp = args.onKeyUp == null ? false : args.onKeyUp;
                        var upDown = args.onKeyDown ? "keyDown" : "keyUp";
                        if (args.onKeyDown) {
                            k.binds[args.keyCode].keyDown[hash] = hash;
                            k.funcs[hash].keyDown[args.keyCode] = args.keyCode;                            
                        }
                        if (args.onKeyUp) {
                            k.binds[args.keyCode].keyUp[hash] = hash;
                            k.funcs[hash].keyUp[args.keyCode] = args.keyCode;
                        }
                    }
                }
                return hash;
            },
            remove(args) { // {keyCode, funcLabel, onKeyDown, onKeyUp, all}, null
                var k = tetresse.listeners.binds;
                if (args == null) { // remove pointerless funcLabels
                    // for (var f in k.funcs) {
                    //     if (f.keyDown == {})
                    // }
                    return;
                }
                if (args.keyCode != null && k.binds[args.keyCode] == null) return; // TODO reportError
                if (args.funcLabel != null && k.funcs[args.funcLabel] == null) return; // TODO reportError
                var removeLink = function(bindsObj, keyCode, funcLabel, onKeyDown, onKeyUp) {
                    onKeyDown = onKeyDown == null ? false : onKeyDown;
                    onKeyUp = onKeyUp == null ? false : onKeyUp;
                    if (onKeyDown) {
                        removeLink.binds[args.keyCode].keyDown[funcLabel] = null;
                        removeLink.funcs[funcLabel].keyDown[args.keyCode] = null;
                    }
                    if (onKeyUp) {
                        k.binds[args.keyCode].keyUp[funcLabel] = null;
                        k.funcs[funcLabel].keyUp[args.keyCode] = null;
                    }
                };
                var flag = args.onKeyDown == null && args.onKeyUp == null;
                args.onKeyDown = args.onKeyDown == null ? true : args.onKeyDown;
                args.onKeyUp = args.onKeyUp == null ? true : args.onKeyUp;
                if (args.keyCode != null && args.funcLabel != null) { // remove specific
                    removeLink(k, args.keyCode, args.funcLabel, args.onKeyDown, args.onKeyUp);
                } else if (args.funcLabel != null) { // remove func stuffs
                    var removeFunc = function(bindsObj, funcLabel, onKeyDown, onKeyUp, del, removeLink) {
                        if (onKeyDown)
                            for (var v in bindsObj.funcs[funcLabel].keyDown)
                                removeLink(bindsObj, v, funcLabel, true);
                        if (onKeyUp)
                            for (var v in bindsObj.funcs[funcLabel].keyUp)
                                removeLink(bindsObj, v, funcLabel, false, true);
                        if (del) // remove func if that is the only argument
                            k.funcs[funcLabel] = null;
                    };
                    if (args.all == null)
                        removeFunc(k, args.funcLabel, args.onKeyDown, args.onKeyUp, flag, removeLink);
                    else // remove all in the same way
                        for (var v in k.funcs)
                            removeFunc(k, v, args.onKeyDown, args.onKeyUp, flag, removeLink);
                } else if (args.keyCode != null) { // remove keyCode
                    if (args.onKeyDown)
                        for (var v in k.binds[args.keyCode].keyDown)
                            removeLink(k, args.keyCode, v, true);
                    if (args.onKeyUp)
                        for (var v in k.binds[args.keyCode].keyUp)
                            removeLink(k, args.keyCode, v, false, true);
                }
            },
            list(args) {
                
            }
        };
    }

    /**
     * Creates the blur listener for specific area (click on the area or go to a different tab)
     */
    static setupBlur() {
        if (tetresse == null) Tetresse.envSetup();
        if (tetresse.listeners.blur != null) return;
        tetresse.listeners.blur = {

        };

    }
}

Tetresse.envSetup();