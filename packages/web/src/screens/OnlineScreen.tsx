import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_LENGTH } from "@myomyw/core";
import { GameLayout, useMatchSnapshot } from "../components/GameLayout.tsx";
import { Button } from "../components/ui.tsx";
import { format, useMessages } from "../i18n/index.tsx";
import { OnlineMatch } from "../match/OnlineMatch.ts";
import { useController } from "../match/useController.ts";
import type { Navigate } from "../routes.ts";
import { serverUrl, useSettings } from "../settings.ts";

export function OnlineScreen({ navigate }: { navigate: Navigate }) {
  const t = useMessages();
  const settings = useSettings();
  const [round, setRound] = useState(0);
  const match = useController(() => new OnlineMatch(serverUrl(settings), settings.name), [round]);
  if (!match) return null;

  const home = () => navigate({ name: "home" });
  return <OnlineGame key={round} match={match} onHome={home} onAgain={() => setRound((r) => r + 1)} title={t.online.title} />;
}

function OnlineGame({ match, onHome, onAgain, title }: { match: OnlineMatch; onHome: () => void; onAgain: () => void; title: string }) {
  const t = useMessages();
  const s = useMatchSnapshot(match);
  const online = s.online!;
  const playing = online.status === "playing";
  return (
    <GameLayout
      match={match}
      title={online.room !== null ? `${title} · ${format(t.online.room, { room: online.room })}` : title}
      leave={{
        label: playing ? t.game.resign : t.common.back,
        confirmBody: playing ? t.game.resignBody : null,
        onLeave: () => {
          if (playing) match.resign();
          onHome();
        },
      }}
      resultTitle={(snap) => (snap.result!.winner === online.side ? t.result.youWin : t.result.youLose)}
      resultActions={
        <>
          <Button onClick={onHome}>{t.game.menu}</Button>
          <Button variant="primary" autoFocus onClick={onAgain}>
            {t.online.findAnother}
          </Button>
        </>
      }
    >
      <section className="online">
        {online.status === "connecting" && <p className="status">{t.online.connecting}</p>}
        {online.status === "matching" && <p className="status status-busy">{t.online.matching}</p>}
        {online.status === "error" && online.error && (
          <div className="status status-error" role="alert">
            <p>{t.online.errors[online.error]}</p>
            <Button variant="primary" onClick={onAgain}>
              {t.online.findAnother}
            </Button>
          </div>
        )}
        {online.motd && <p className="motd">{online.motd}</p>}
        {(playing || online.chat.length > 0) && <Chat match={match} />}
      </section>
    </GameLayout>
  );
}

function Chat({ match }: { match: OnlineMatch }) {
  const t = useMessages();
  const s = useMatchSnapshot(match);
  const [text, setText] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const chat = s.online!.chat;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.length]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    match.chat(text);
    setText("");
  };

  return (
    <div className="chat">
      <ol ref={list} className="chat-log" aria-live="polite">
        {chat.map((line, i) => (
          <li key={i} className={`chat-${line.from}`}>
            <strong>{line.from === "me" ? t.online.you : t.online.opponent}:</strong> {line.text}
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <input value={text} maxLength={MAX_CHAT_LENGTH} onChange={(e) => setText(e.target.value)} placeholder={t.online.chatPlaceholder} disabled={s.online!.status !== "playing"} />
        <Button type="submit" disabled={!text.trim() || s.online!.status !== "playing"}>
          {t.online.send}
        </Button>
      </form>
    </div>
  );
}
