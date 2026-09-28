/**
 * TypeScript bindings for the Rust engine compiled to WebAssembly
 * (`dist/myomyw_engine.wasm`, built by `npm run build:wasm`).
 *
 * The module has no imports and a small C ABI (see `src/ffi.rs`). Objects
 * created here own memory inside the module: call `free()` when done (a
 * FinalizationRegistry frees forgotten objects eventually).
 */
import { Board, RULES, type Agent, type Ball, type Side } from "@myomyw/core";

interface Exports {
  memory: WebAssembly.Memory;
  io_buffer(): number;
  board_from_io(): number;
  board_to_io(board: number): void;
  board_free(board: number): void;
  board_push(board: number, side: number, col: number, ball: number): number;
  board_evaluate(board: number): number;
  agent_new(kind: number, depth: number, fillout: number, seed: number): number;
  agent_free(agent: number): void;
  agent_begin_turn(agent: number): number;
  agent_first_push(agent: number, next: number): number;
  agent_push_again(agent: number, next: number): number;
}

/** `u32::MAX` error result. Results are read with `>>> 0` because WebAssembly i32 values arrive signed. */
const INVALID = 0xffffffff;
const CELLS = RULES.maxCols * RULES.maxCols;

/** `easy` | `normal` | `hard` | `strong:<maxDepth>,<fillout>` — the same specs as `agentFromSpec`. */
export type AgentSpec = string;

function parseSpec(spec: AgentSpec): { kind: number; depth: number; fillout: number } {
  switch (spec) {
    case "easy":
      return { kind: 0, depth: 0, fillout: 0 };
    case "normal":
      return { kind: 1, depth: 1, fillout: 10 };
    case "hard":
      return { kind: 1, depth: 2, fillout: 10 };
  }
  const custom = /^strong:(\d+),(\d+)$/.exec(spec);
  if (custom) return { kind: 1, depth: Number(custom[1]), fillout: Number(custom[2]) };
  throw new Error(`Unknown agent "${spec}"`);
}

export type WasmSource = BufferSource | Response | PromiseLike<Response>;

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

  /** Creates an AI player; with the same `seed` it plays exactly like the TypeScript agent seeded with `seededRng(seed)`. */
  createAgent(spec: AgentSpec, seed: number): WasmAgent {
    const { kind, depth, fillout } = parseSpec(spec);
    const ptr = this.exports.agent_new(kind, depth, fillout, seed >>> 0);
    if (ptr === 0) throw new Error(`Invalid agent "${spec}"`);
    const agent = new WasmAgent(this, ptr, spec);
    this.track(agent, () => this.exports.agent_free(ptr));
    return agent;
  }

  /** Copies a board into the engine (mainly for tests and analysis). */
  createBoard(board: Board): WasmBoard {
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

  /** @internal Writes a board into the I/O buffer. */
  writeBoard(board: Board): void {
    const io = new Uint8Array(this.exports.memory.buffer, this.ioPtr, 2 + CELLS);
    io[0] = board.lCol;
    io[1] = board.rCol;
    for (let l = 0; l < RULES.maxCols; l++) {
      for (let r = 0; r < RULES.maxCols; r++) io[2 + l * RULES.maxCols + r] = l < board.lCol && r < board.rCol ? board.cells[l]![r]! : 0;
    }
  }

  /** @internal Reads a board from the I/O buffer. */
  readBoard(): Board {
    const io = new Uint8Array(this.exports.memory.buffer, this.ioPtr, 2 + CELLS);
    const board = Board.initial();
    for (let l = 0; l < RULES.maxCols; l++) {
      for (let r = 0; r < RULES.maxCols; r++) board.cells[l]![r] = io[2 + l * RULES.maxCols + r] as Ball;
    }
    board.lCol = io[0]!;
    board.rCol = io[1]!;
    return board;
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

/** A board living inside the engine. */
export class WasmBoard implements Freeable {
  private ptr: number;
  private readonly engine: Engine;

  /** @internal */
  constructor(engine: Engine, ptr: number) {
    this.engine = engine;
    this.ptr = ptr;
  }

  /** One push (see `Board.push`); returns the ball that fell off. */
  push(side: Side, col: number, ball: Ball): Ball {
    const ejected = this.engine.raw.board_push(this.live(), side, col, ball) >>> 0;
    if (ejected === INVALID) throw new Error(`Invalid push (side ${side}, line ${col}, ball ${ball})`);
    return ejected as Ball;
  }

  /** The classic static evaluation, from Left's point of view. */
  evaluate(): number {
    return this.engine.raw.board_evaluate(this.live());
  }

  /** A copy of the board as a `@myomyw/core` Board (cells outside the board are common). */
  read(): Board {
    this.engine.raw.board_to_io(this.live());
    return this.engine.readBoard();
  }

  free(): void {
    if (this.ptr === 0) return;
    this.engine.untrack(this);
    this.engine.raw.board_free(this.ptr);
    this.ptr = 0;
  }

  private live(): number {
    if (this.ptr === 0) throw new Error("Board already freed");
    return this.ptr;
  }
}

/** An AI player running inside the engine. Implements the `Agent` protocol of `@myomyw/core`. */
export class WasmAgent implements Agent, Freeable {
  readonly name: string;
  private ptr: number;
  private readonly engine: Engine;

  /** @internal */
  constructor(engine: Engine, ptr: number, spec: AgentSpec) {
    this.engine = engine;
    this.ptr = ptr;
    this.name = `wasm:${spec}`;
  }

  beginTurn(view: Board): void {
    this.engine.writeBoard(view);
    if (this.engine.raw.agent_begin_turn(this.live()) >>> 0 === INVALID) throw new Error("Invalid board");
  }

  firstPush(next: Ball): number {
    return this.check(this.engine.raw.agent_first_push(this.live(), next));
  }

  pushAgain(next: Ball): boolean {
    return this.check(this.engine.raw.agent_push_again(this.live(), next)) === 1;
  }

  free(): void {
    if (this.ptr === 0) return;
    this.engine.untrack(this);
    this.engine.raw.agent_free(this.ptr);
    this.ptr = 0;
  }

  private check(result: number): number {
    result >>>= 0;
    if (result === INVALID) throw new Error("Invalid ball");
    return result;
  }

  private live(): number {
    if (this.ptr === 0) throw new Error("Agent already freed");
    return this.ptr;
  }
}
