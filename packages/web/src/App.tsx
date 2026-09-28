import { useEffect, useState } from "react";
import { MessagesContext, messagesFor, resolveLanguage } from "./i18n/index.tsx";
import type { Route } from "./routes.ts";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { LocalGameScreen } from "./screens/LocalGameScreen.tsx";
import { OnlineScreen } from "./screens/OnlineScreen.tsx";
import { RulesScreen } from "./screens/RulesScreen.tsx";
import { SettingsScreen } from "./screens/SettingsScreen.tsx";
import { TutorialScreen } from "./screens/TutorialScreen.tsx";
import { useSettings } from "./settings.ts";

export function App() {
  const settings = useSettings();
  const language = resolveLanguage(settings.language);
  const [route, navigate] = useState<Route>({ name: "home" });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  let screen;
  switch (route.name) {
    case "home":
      screen = <HomeScreen navigate={navigate} />;
      break;
    case "vsComputer":
    case "twoPlayers":
    case "aiVsAi":
      screen = <LocalGameScreen key={JSON.stringify(route)} route={route} navigate={navigate} />;
      break;
    case "online":
      screen = <OnlineScreen navigate={navigate} />;
      break;
    case "tutorial":
      screen = <TutorialScreen navigate={navigate} />;
      break;
    case "rules":
      screen = <RulesScreen navigate={navigate} />;
      break;
    case "settings":
      screen = <SettingsScreen navigate={navigate} />;
      break;
  }

  return <MessagesContext.Provider value={messagesFor(language)}>{screen}</MessagesContext.Provider>;
}
