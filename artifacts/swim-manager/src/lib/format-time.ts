export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 60) {
    return seconds.toFixed(2);
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(2);
  const paddedSeconds = remainingSeconds.padStart(5, "0");
  return `${minutes}:${paddedSeconds}`;
}

export function parseTime(timeStr: string): number | null {
  if (!timeStr || timeStr.trim() === "") return null;
  const parts = timeStr.split(":");
  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? null : val;
  } else if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  return null;
}
