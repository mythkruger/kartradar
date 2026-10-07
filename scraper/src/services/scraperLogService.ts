export type LogLevel = "info" | "success" | "warning" | "error";

export interface ScraperLog {
  time: string;
  level: LogLevel;
  message: string;
  /** Hangi siteye ait. Genel loglarda (tüm scraperlar) boş. */
  siteId?: string;
}

const logs: ScraperLog[] = [];

const MAX_LOGS = 1000;

export function addLog(level: LogLevel, message: string, siteId?: string) {
  const time = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  logs.unshift({ time, level, message, siteId });

  if (level === "error") console.error(`[${time}] ${message}`);
  else console.log(`[${time}] ${level.toUpperCase()} ${message}`);

  while (logs.length > MAX_LOGS) logs.pop();
}

export function getLogs(): ScraperLog[] {
  return logs;
}

export function clearLogs() {
  logs.length = 0;
}
