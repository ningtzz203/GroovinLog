export type IconName = "home" | "plus" | "practice" | "review" | "settings" | "arrow" | "clock" | "play" | "spark" | "calendar";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  practice: <><path d="M5 8.5h14M5 15.5h14M8 5v7M16 12v7"/><circle cx="8" cy="15.5" r="2"/><circle cx="16" cy="8.5" r="2"/></>,
  review: <><path d="M4 19V8M10 19V4M16 19v-7M22 19H2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"/></>,
  arrow: <><path d="m9 18 6-6-6-6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
  spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
