/**
 * TypeScript bindings for the Rust engine compiled to WebAssembly
 * (`dist/myomyw_engine.wasm`, built by `npm run build:wasm`).
 *
 * The module has no imports and a small C ABI (see `src/ffi.rs`). Objects
 * created here own memory inside the module: call `free()` when done (a
 * FinalizationRegistry frees forgotten objects eventually).
 */
import {
  END_REASONS,
  IllegalMoveError,
  RULES,
  type Ball,
  type BoardSnapshot,
  type EndReason,
  type GameResult,
  type PushOutcome,
  type Side,
} from "./types.ts";

export * from "./types.ts";

interface Exports {
  memory: WebAssembly.Memory;
  io_buffer(): number;
  board_from_io(): number;
  board_to_io(board: number): void;
  board_free(board: number): void;
  board_push(board: number, side: number, col: number, ball: number): number;
  board_evaluate(board: number): number;
  game_new(seed: number, first: number): number;
  game_free(game: number): void;
  game_to_io(game: number): void;
  game_view_to_io(game: number): void;
  game_can_push(game: number, col: number): number;
  game_can_end_turn(game: number): number;
  game_push(game: number, col: number, following: number): number;
  game_end_turn(game: number): number;
  game_timeout(game: number): void;
  game_forfeit(game: number, loser: number, reason: number): number;
  game_set_ball(game: number, l: number, r: number, ball: number): number;
  agent_new(kind: number, depth: number, fillout: number, seed: number): number;
  agent_new_mcts(iters: number, puct: number, seed: number): number;
  agent_free(agent: number): void;
  agent_begin_turn(agent: number): number;
  agent_first_push(agent: number, next: number): number;
  agent_push_again(agent: number, next: number): number;
  agent_win_estimate(agent: number): number;
}

/** `u32::MAX` error result. WebAssembly i32 results arrive signed, so they are read with `>>> 0`. */
const INVALID = 0xffffffff;
/** "Use the engine's own random ball" (any value that is not a ball id). */
const DRAW = 0xff;
const N = RULES.maxCols;
const BOARD_LEN = 2 + N * N;
const NONE = 255;

/**
 * An agent spec: `easy` | `normal` | `hard` | `impossible` |
 * `strong:<maxDepth>,<fillout>` | `mcts:<key>=<value>,…` (see {@link mctsSpec}).
 */
export type AgentSpec = string;

/** Settings of a custom MCTS agent (the Impossible AI's search and network). */
export interface MctsSettings {
  /**
   * Search iterations (tree expansions) per decision: a positive integer (the
   * engine counts them in 32 bits). 1 plays the policy network directly.
   */
  iters: number;
  /** PUCT exploration constant (> 0); the Impossible AI uses 0.5. */
  puct: number;
}

/** The Impossible AI's settings. */
export const IMPOSSIBLE_MCTS: MctsSettings = { iters: 50_000, puct: 0.5 };

/** Whether settings make a valid MCTS agent. */
export function validMcts({ iters, puct }: MctsSettings): boolean {
  return Number.isInteger(iters) && iters >= 1 && iters <= 0xffff_ffff && Number.isFinite(puct) && puct > 0;
}

/** The spec of a custom MCTS agent, e.g. `mcts:iters=5000,puct=0.5`. */
export function mctsSpec({ iters, puct }: MctsSettings): AgentSpec {
  return `mcts:iters=${iters},puct=${puct}`;
}

type ParsedSpec = { kind: number; depth: number; fillout: number } | ({ kind: "mcts" } & MctsSettings);

function parseSpec(spec: AgentSpec): ParsedSpec {
  switch (spec) {
    case "easy":
      return { kind: 0, depth: 0, fillout: 0 };
    case "normal":
      return { kind: 1, depth: 1, fillout: 10 };
    case "hard":
      return { kind: 1, depth: 2, fillout: 10 };
    case "impossible":
      return { kind: 2, depth: 0, fillout: 0 };
  }
  const custom = /^strong:(\d+),(\d+)$/.exec(spec);
  if (custom) return { kind: 1, depth: Number(custom[1]), fillout: Number(custom[2]) };
  if (spec.startsWith("mcts:")) {
    const settings = { ...IMPOSSIBLE_MCTS };
    const keys: Record<string, keyof MctsSettings> = { iters: "iters", puct: "puct" };
    for (const item of spec.slice(5).split(",").filter(Boolean)) {
      const [key, value] = item.split("=");
      const field = keys[key ?? ""];
      if (!field || value === undefined || value.trim() === "" || !Number.isFinite(Number(value))) throw new Error(`Bad MCTS option "${item}"`);
      settings[field] = Number(value);
    }
    if (!validMcts(settings)) throw new Error(`Invalid MCTS settings in "${spec}"`);
    return { kind: "mcts", ...settings };
  }
  throw new Error(`Unknown agent "${spec}"`);
}

/** A random 32-bit seed. */
export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

export type WasmSource = BufferSource | Response | PromiseLike<Response>;

export interface GameOptions {
  /** Seed of the generator that draws the balls (random if omitted). */
  seed?: number;
  /** Supplies the balls instead of the engine's generator (e.g. a scripted tutorial). */
  ballSource?: () => Ball;
}

/** A loaded instance of the engine. */
export class Engine {
  private readonly exports: Exports;
  private readonly ioPtr: number;
  private readonly registry = new FinalizationRegistry<() => void>((free) => free());

  private constructor(exports: Exports) {
    this.exports = exports;
    this.ioPtr = exports.io_buffer();
  }

  /** Instantiates the module from its bytes or a `fetch` response. */
  static async load(source: WasmSource): Promise<Engine> {
    let instance: WebAssembly.Instance;
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      instance = (await WebAssembly.instantiate(source, {})).instance;
    } else {
      const response = await source;
      if (!response.ok) throw new Error(`Failed to fetch the engine: HTTP ${response.status}`);
      try {
        instance = (await WebAssembly.instantiateStreaming(response.clone(), {})).instance;
      } catch {
        // Wrong MIME type or no streaming support.
        instance = (await WebAssembly.instantiate(await response.arrayBuffer(), {})).instance;
      }
    }
    return new Engine(instance.exports as unknown as Exports);
  }

  /** Instantiates the module synchronously (Node, workers). */
  static fromBytes(bytes: BufferSource): Engine {
    return new Engine(new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as Exports);
  }

  /** A new game: initial position, Left to move. */
  newGame(options: GameOptions = {}): WasmGame {
    const source = options.ballSource;
    const ptr = this.exports.game_new(options.seed ?? randomSeed(), source ? source() : DRAW);
    const game = new WasmGame(this, ptr, source);
    this.track(game, () => this.exports.game_free(ptr));
    return game;
  }

  /** Creates an AI player; the same spec and seed always play the same way. */
  createAgent(spec: AgentSpec, seed: number = randomSeed()): WasmAgent {
    const parsed = parseSpec(spec);
    const ptr =
      parsed.kind === "mcts"
        ? this.exports.agent_new_mcts(parsed.iters, parsed.puct, seed >>> 0)
        : this.exports.agent_new(parsed.kind, parsed.depth, parsed.fillout, seed >>> 0);
    if (ptr === 0) throw new Error(`Invalid agent "${spec}"`);
    const agent = new WasmAgent(this, ptr, spec);
    this.track(agent, () => this.exports.agent_free(ptr));
    return agent;
  }

  /** Copies a board into the engine (for analysis, tests, and mirroring remote games). */
  createBoard(board: BoardSnapshot): WasmBoard {
    this.writeBoard(board);
    const ptr = this.exports.board_from_io();
    if (ptr === 0) throw new Error("Invalid board");
    const wasmBoard = new WasmBoard(this, ptr);
    this.track(wasmBoard, () => this.exports.board_free(ptr));
    return wasmBoard;
  }

  /** @internal */
  get raw(): Exports {
    return this.exports;
  }

  /** @internal The I/O buffer; recreated per call because memory growth detaches old views. */
  io(): Uint8Array {
    return new Uint8Array(this.exports.memory.buffer, this.ioPtr, BOARD_LEN + 6);
  }

  /** @internal */
  writeBoard(board: BoardSnapshot): void {
    const io = this.io();
    io[0] = board.lCol;
    io[1] = board.rCol;
    for (let l = 0; l < N; l++) {
      for (let r = 0; r < N; r++) io[2 + l * N + r] = l < board.lCol && r < board.rCol ? board.cells[l]![r]! : 0;
    }
  }

  /** @internal */
  readBoard(): BoardSnapshot {
    const io = this.io();
    const cells: Ball[][] = [];
    for (let l = 0; l < N; l++) cells.push(Array.from(io.subarray(2 + l * N, 2 + (l + 1) * N)) as Ball[]);
    return { cells, lCol: io[0]!, rCol: io[1]! };
  }

  /** @internal */
  track(owner: Freeable, free: () => void): void {
    this.registry.register(owner, free, owner);
  }

  /** @internal */
  untrack(owner: Freeable): void {
    this.registry.unregister(owner);
  }
}

interface Freeable {
  free(): void;
}

abstract class Handle implements Freeable {
  protected readonly engine: Engine;
  private ptr: number;
  private readonly release: (ptr: number) => void;

  constructor(engine: Engine, ptr: number, release: (ptr: number) => void) {
    this.engine = engine;
    this.ptr = ptr;
    this.release = release;
  }

  free(): void {
    if (this.ptr === 0) return;
    this.engine.untrack(this);
    this.release(this.ptr);
    this.ptr = 0;
  }

  protected get live(): number {
    if (this.ptr === 0) throw new Error("Object already freed");
    return this.ptr;
  }
}

/**
 * A complete game (the rules of docs/rules.md) living in the engine. The
 * state getters are plain data refreshed after every change.
 */
export class WasmGame extends Handle {
  private readonly ballSource: (() => Ball) | undefined;
  board!: BoardSnapshot;
  /** Player to move. */
  turn!: Side;
  /** The ball the next push (by either player) will insert. */
  next!: Ball;
  /** Pushes made in the current turn. */
  pushes!: number;
  /** The line chosen this turn, or null before the first push. */
  column!: number | null;
  result!: GameResult | null;

  /** @internal */
  constructor(engine: Engine, ptr: number, ballSource?: () => Ball) {
    super(engine, ptr, (p) => engine.raw.game_free(p));
    this.ballSource = ballSource;
    this.refresh();
  }

  get over(): boolean {
    return this.result !== null;
  }

  /** Whether the player to move may push line `col` now. */
  canPush(col: number): boolean {
    return Number.isInteger(col) && col >= 0 && this.engine.raw.game_can_push(this.live, col) === 1;
  }

  /** Whether the player to move may end the turn now (after at least one push). */
  canEndTurn(): boolean {
    return this.engine.raw.game_can_end_turn(this.live) === 1;
  }

  push(col: number): PushOutcome {
    if (!this.canPush(col)) throw new IllegalMoveError(`Illegal push on line ${col}`);
    const side = this.turn;
    const packed = this.engine.raw.game_push(this.live, col, this.ballSource ? this.ballSource() : DRAW) >>> 0;
    if (packed === INVALID) throw new IllegalMoveError(`Illegal push on line ${col}`);
    const pushes = this.pushes + 1;
    this.refresh();
    return {
      side,
      col,
      ejected: (packed & 0xff) as Ball,
      inserted: ((packed >> 8) & 0xff) as Ball,
      pushes,
      turnEnded: (packed >> 16) === 1,
      result: this.result,
    };
  }

  endTurn(): void {
    if (this.engine.raw.game_end_turn(this.live) >>> 0 === INVALID) throw new IllegalMoveError("Cannot end the turn before pushing");
    this.refresh();
  }

  /** The player to move ran out of time. */
  timeout(): GameResult {
    this.engine.raw.game_timeout(this.live);
    this.refresh();
    return this.result!;
  }

  /** `loser` gave up or left. */
  forfeit(loser: Side, reason: "resign" | "disconnect" = "resign"): GameResult {
    this.engine.raw.game_forfeit(this.live, loser, END_REASONS.indexOf(reason));
    this.refresh();
    return this.result!;
  }

  /** The board as seen by the player to move (flipped for Right): what an agent receives. */
  view(): BoardSnapshot {
    this.engine.raw.game_view_to_io(this.live);
    return this.engine.readBoard();
  }

  /** Replaces a ball in place (used by the tutorial). */
  setBall(l: number, r: number, ball: Ball): void {
    if (this.engine.raw.game_set_ball(this.live, l, r, ball) >>> 0 === INVALID) throw new Error(`Invalid cell (${l}, ${r})`);
    this.refresh();
  }

  private refresh(): void {
    this.engine.raw.game_to_io(this.live);
    this.board = this.engine.readBoard();
    const io = this.engine.io();
    const [turn, next, pushes, column, winner, reason] = io.subarray(BOARD_LEN, BOARD_LEN + 6);
    this.turn = turn as Side;
    this.next = next as Ball;
    this.pushes = pushes!;
    this.column = column === NONE ? null : column!;
    this.result = winner === NONE ? null : { winner: winner as Side, reason: END_REASONS[reason!] as EndReason };
  }
}

/** A board living inside the engine. */
export class WasmBoard extends Handle {
  /** @internal */
  constructor(engine: Engine, ptr: number) {
    super(engine, ptr, (p) => engine.raw.board_free(p));
  }

  /** One push; returns the ball that fell off (its effect is applied). */
  push(side: Side, col: number, ball: Ball): Ball {
    const ejected = this.engine.raw.board_push(this.live, side, col, ball) >>> 0;
    if (ejected === INVALID) throw new IllegalMoveError(`Invalid push (side ${side}, line ${col}, ball ${ball})`);
    return ejected as Ball;
  }

  /** The classic static evaluation, from Left's point of view. */
  evaluate(): number {
    return this.engine.raw.board_evaluate(this.live);
  }

  read(): BoardSnapshot {
    this.engine.raw.board_to_io(this.live);
    return this.engine.readBoard();
  }
}

/**
 * An AI player running inside the engine (docs/ai.md). Agents play as Left:
 * pass them `game.view()`. Per turn: `beginTurn`, `firstPush(next)`, then
 * `pushAgain(next)` with each new next ball while the turn continues.
 */
export class WasmAgent extends Handle {
  readonly name: string;

  /** @internal */
  constructor(engine: Engine, ptr: number, spec: AgentSpec) {
    super(engine, ptr, (p) => engine.raw.agent_free(p));
    this.name = spec;
  }

  beginTurn(view: BoardSnapshot): void {
    this.engine.writeBoard(view);
    if (this.engine.raw.agent_begin_turn(this.live) >>> 0 === INVALID) throw new Error("Invalid board");
  }

  firstPush(next: Ball): number {
    return this.check(this.engine.raw.agent_first_push(this.live, next));
  }

  pushAgain(next: Ball): boolean {
    return this.check(this.engine.raw.agent_push_again(this.live, next)) === 1;
  }

  /** The agent's estimated probability of winning as of its latest decision (0–1), if it computes one. */
  winEstimate(): number | null {
    const p = this.engine.raw.agent_win_estimate(this.live);
    return p >= 0 ? p : null;
  }

  private check(result: number): number {
    if (result >>> 0 === INVALID) throw new Error("Invalid ball");
    return result >>> 0;
  }
}
