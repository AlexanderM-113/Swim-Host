import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type AppModule = "meet" | "team" | "workout" | null;

interface ModuleContextValue {
  activeModule: AppModule;
  setActiveModule: (m: AppModule) => void;
  showLauncher: boolean;
  setShowLauncher: (v: boolean) => void;
}

const ModuleContext = createContext<ModuleContextValue>({
  activeModule: null,
  setActiveModule: () => {},
  showLauncher: false,
  setShowLauncher: () => {},
});

const STORAGE_KEY = "swimpro_active_module";

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<AppModule>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as AppModule) ?? null;
  });
  const [showLauncher, setShowLauncher] = useState(false);

  useEffect(() => {
    if (activeModule === null) {
      setShowLauncher(true);
    }
  }, []);

  function setActiveModule(m: AppModule) {
    setActiveModuleState(m);
    if (m) {
      localStorage.setItem(STORAGE_KEY, m);
      setShowLauncher(false);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, showLauncher, setShowLauncher }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  return useContext(ModuleContext);
}
