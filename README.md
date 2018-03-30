

Create new display: TODO

Documentation:
    How to read the documentation (meta): WYSIMWYG, comments within comments shown in the example are side notes reffering to documentation standards used in tetresse
---example---
/**
 * General description of function.
 * args: // keep {var1, var2, var3} on same line if only 1 set (no {var1, var4, var5}) 
 *   {var1, (var2), (var3)} // parentheses around optional
 *       general description of what this set of args does
 *   - var1: does var1 stuff
 *   - var2: does var2 stuff
 *   - var3: false by default, does var3 stuff
 *   {var1, var4, var5}
 *       general description of what this set of args does
 *   - var1: something different than previously specified // leave out line if same as previously specified
 *   - var4: does var4 stuff
 *   - var5: does var5 stuff
 * bar: string doing bar stuff
 * returns: something // leave out if nothing
 *
foo(args, bar) { // {var1, var2, var3, var4, var5} // args value
    
}

Tetresse: js game which handles gameplay, sends actions, recieves formatted garbage (does not generate)
  Board[row][col]{content}
  piece
    cur: current
        p: piece
        loc: location
        rot: rotation
        arr: array of the piece layout
        kick: whether the piece was just kicked into place
        gravity: number of times moved / rotated since gravity took place
    upNext: array of the next pieces
    move(bool update, amount): moves piece that amount if possible and returns whether it's valid
    rotate(amount cw): rotates piece that amount if possible and returns whether it's valid
    place(): places the piece
    next(piece): removes current piece and adds next if piece is null, else adds piece = {cur, loc, rot}
    gravity(): activates gravity, moving piece down
    get(): returns piece = {cur, loc, rot}
    isValid(): checks validity of piece
  actions
    buffer: actions to be executed
    add(): add action or label
    pause(): pauses actions
    remove(): removes next number of actions
    clear():
  settings
    game
      board: shown row, rows above, shown col
      sending lines: spins allowed, strength of clears, line delay, reward spiked or consistant APM
      recieving lines: ...
      canceling lines: ...
      visual: next pieces, hold piece, board (only rows x through y?), current piece
      topping out: ...
      team control: ...
      misc: game time limit
      extensions: added through
        record, stream, replay, play, display, style, etc
    user
      pieceMovement: ARR, DAS, inverted controls, IRS?
      keybinds
      records?
      style?
    util
      debug?
  peripherals
    upNext
    hold
    abilities
  listeners
    clock
      pause()
      resume()
      reset()
    add(args) {label: stuff}, {label: stuff, func: func()}
    toggle(args) args: function, set awake or asleep
    execute(name)
    labels
      pieces:
        move(): move[Attempted[Right,Left], d[ Right[Multiple], Left[Multiple], Multiple ] ]
        rotate(): rotate[Attempted[CW,CCW,180], d[CW,CCW,180]]
      startGame
      endGame
      pause
      resume
      pieceSpawn
      piecePlaced
      spin: includes different pieces
      lineCleared: 1 or more
      addAction (just do stuff outside of game class (don't change game))
      executeAction?
      tick: every 100ms
      sec: every second?
      min: every minute?
    awake
      startGame: [func1, func2...]
      ...
    asleep
      startGame: [func3, func4...]
      ...
    funcs: [{func: func1, awakeLabels: [], asleepLabels: []}, func2, func3...]
  display
    setup(type[, value]) types: div, canvas, within canvas
    update(type, value) eg: update("tile", {row:0,col:1:,content:'i'})
  reset() when game should be restarted
  create(settings) when page loads
  record
    stats
    actions
    export()
    import(json)

tetresse global variable
  games: array of games displayed
  utils:
    shuffle(arr): fisher yates shuffle
    rotate(arr, amount): matrix transformation
    piece
        rotationChart: kicks etc
        Layout: matrices of pieces (loc is top right of layout)
        spawnLoc: default spawn location
        finesse: finesse chart?
  listeners: object of listeners listening
    resize: {list: [{func, args}, {func, args}], active, pause, resume} display listener for window resize event