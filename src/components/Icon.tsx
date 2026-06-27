/* Custom SVG icon library — 24px grid, round caps/joins, currentColor stroke.
   Soft duotone fills via .ic-soft at low opacity for tiles and habit cards. */

const PATHS: Record<string, React.ReactNode> = {
  /* ---- Nav ---- */
  home: (
    <>
      <path d="M3.5 11.4 12 4.5l8.5 6.9" />
      <path d="M5.6 10v9.5h12.8V10" />
      <path d="M9.7 19.5v-5.2h4.6v5.2" />
    </>
  ),
  garden: (
    <>
      <path d="M12 21.5V11.5" />
      <path d="M12 15.2C8.4 15.2 6.3 12.6 6.3 9c3.6 0 5.7 2.6 5.7 6.2Z" className="ic-soft" />
      <path d="M12 12.2C12 9.1 13.8 7 16.7 7c0 3.1-1.8 5.2-4.7 5.2Z" className="ic-soft" />
    </>
  ),
  jobs: (
    <>
      <path d="M3.8 5.2h16.4l-6 7v6.4l-4.4-2.2v-4.2z" className="ic-soft" />
    </>
  ),
  reflect: (
    <>
      <path d="M3 12.2h3.6l1.9-4.4 3 8.4 2.2-5 1.3 1H21" />
    </>
  ),

  /* ---- Habit glyphs ---- */
  walk: (
    <>
      <circle cx="12.3" cy="4.6" r="1.9" />
      <path d="M12 6.8 10.9 13" />
      <path d="M10.9 13 13.4 19" />
      <path d="M10.9 13 8.4 18.4" />
      <path d="M12.1 8.7 9.6 11.1" />
      <path d="M12.1 8.7 14.6 10.3" />
    </>
  ),
  code: (
    <>
      <path d="M8.6 8 4.6 12l4 4" />
      <path d="M15.4 8l4 4-4 4" />
      <path d="M13.2 6 10.8 18" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.2C10 4.7 6.6 4.7 4.6 5.7v12.1c2-1 5.4-1 7.4.6 2-1.6 5.4-1.6 7.4-.6V5.7c-2-1-5.4-1-7.4.5Z" className="ic-soft" />
      <path d="M12 6.2v12.2" />
    </>
  ),
  water: (
    <>
      <path d="M12 3.2S6.2 9.8 6.2 14a5.8 5.8 0 0 0 11.6 0c0-4.2-5.8-10.8-5.8-10.8Z" className="ic-soft" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.7" className="ic-soft" />
      <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14Z" className="ic-soft" />
      <path d="M5 19 14.5 9.5" />
    </>
  ),
  lift: (
    <>
      <path d="M5 9.2v5.6M8 7.4v10.2M8 12h8M16 7.4v10.2M19 9.2v5.6" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20.2 5.1 16 16 5.1l3 3L8.1 19l-4.1 1.2Z" className="ic-soft" />
      <path d="M14 7.1 17 10.1" />
    </>
  ),
  meditate: (
    <>
      <circle cx="12" cy="6" r="2.1" />
      <path d="M12 8.4c-4 1-7 4-7.5 8 3.6 1 11.4 1 15 0-.5-4-3.5-7-7.5-8Z" className="ic-soft" />
    </>
  ),
  moon: (
    <>
      <path d="M17 13.2A6.2 6.2 0 1 1 10.8 5a4.8 4.8 0 0 0 6.2 8.2Z" className="ic-soft" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20.3S3.8 14.7 3.8 9.2A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 8.2 2.1c0 5.5-8.2 11.1-8.2 11.1Z" className="ic-soft" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.8" cy="18" r="2.2" className="ic-soft" />
      <circle cx="16.8" cy="16" r="2.2" className="ic-soft" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8.5h12v4.3a4.2 4.2 0 0 1-4.2 4.2H9.2A4.2 4.2 0 0 1 5 12.8Z" className="ic-soft" />
      <path d="M17 9.5h1.8a2 2 0 0 1 0 4H17" />
      <path d="M8.5 3.5c-.6.7-.6 1.4 0 2.1M11.5 3.5c-.6.7-.6 1.4 0 2.1" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3c.5 5 1 5.5 6 6-5 .5-5.5 1-6 6-.5-5-1-5.5-6-6 5-.5 5.5-1 6-6Z" className="ic-soft" />
      <path d="M18.5 4c.2 1.8.4 2 2.2 2.2-1.8.2-2 .4-2.2 2.2-.2-1.8-.4-2-2.2-2.2 1.8-.2 2-.4 2.2-2.2Z" />
    </>
  ),

  /* ---- Job stages ---- */
  saved: (
    <>
      <path d="M7 4h10v16l-5-3.6L7 20Z" className="ic-soft" />
    </>
  ),
  applied: (
    <>
      <path d="M20.5 4 3.5 11.2l6.4 1.9 1.9 6.4z" className="ic-soft" />
      <path d="M9.9 13.1 20.5 4" />
    </>
  ),
  screen: (
    <>
      <path d="M5 5h14v9.5h-7.5L8 18.5v-4H5Z" className="ic-soft" />
      <path d="M9 9.3h6M9 11.6h3.5" />
    </>
  ),
  interview: (
    <>
      <circle cx="9" cy="7.3" r="2.3" />
      <path d="M4.6 18c0-3.2 2-4.9 4.4-4.9 1.3 0 2.5.5 3.3 1.5" />
      <circle cx="15.4" cy="8.4" r="1.9" />
      <path d="M12.6 17.6c.2-2.5 1.5-3.6 2.8-3.6 2 0 3.6 1.5 3.6 4" />
    </>
  ),
  offer: (
    <>
      <path d="M12 2.8c.6 5.6 1.2 6.2 6.8 6.8-5.6.6-6.2 1.2-6.8 6.8-.6-5.6-1.2-6.2-6.8-6.8 5.6-.6 6.2-1.2 6.8-6.8Z" className="ic-soft" />
      <path d="M6.5 17.5c.2 1.7.4 1.9 2.1 2.1-1.7.2-1.9.4-2.1 2.1-.2-1.7-.4-1.9-2.1-2.1 1.7-.2 1.9-.4 2.1-2.1Z" />
    </>
  ),
  rejected: (
    <>
      <path d="M18.4 9A7 7 0 1 0 19 12.5" />
      <path d="M18.6 4.5 18.4 9l-4.5-.6" />
    </>
  ),

  /* ---- Prompt types ---- */
  gratitude: (
    <>
      <path d="M12 20.3S3.8 14.7 3.8 9.2A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 8.2 2.1c0 5.5-8.2 11.1-8.2 11.1Z" className="ic-soft" />
    </>
  ),
  reframe: (
    <>
      <path d="M5.5 11A6.5 6.5 0 0 1 17 7.5l2 1.8" />
      <path d="M18.5 13A6.5 6.5 0 0 1 7 16.5l-2-1.8" />
      <path d="M19.2 5.2 19 9.3l-4.1-.3M4.8 18.8 5 14.7l4.1.3" />
    </>
  ),
  identity: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 6.5 13.6 11 18 12l-4.4 1-1.6 4.5-1.6-4.5L6 12l4.4-1z" className="ic-soft" />
    </>
  ),

  /* ---- UI ---- */
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5 10 17.5 19.5 6.5" />,
  chevronDown: <path d="M6 9.5 12 15.5l6-6" />,
  chevronRight: <path d="M9 5.5 15.5 12 9 18.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrowRight: <path d="M4.5 12h14M13 6.5 18.5 12 13 17.5" />,
  edit: (
    <>
      <path d="M4 20.2 5.1 16 16 5.1l3 3L8.1 19l-4.1 1.2Z" className="ic-soft" />
      <path d="M14 7.1 17 10.1" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h5M13 8h7M4 16h11M19 16h1" />
      <circle cx="11" cy="8" r="2.1" className="ic-soft" />
      <circle cx="17" cy="16" r="2.1" className="ic-soft" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3.5s5 4 5 8.5a5 5 0 0 1-10 0c0-1.6.8-3 .8-3 .4 1 1.2 1.6 1.2 1.6.4-3 3-7.1 3-7.1Z" className="ic-soft" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.2" width="16" height="15" rx="2.6" className="ic-soft" />
      <path d="M4 9.4h16M8.5 3.5v3.4M15.5 3.5v3.4" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </>
  ),

  /* ---- Focus ---- */
  focus: (
    <>
      <circle cx="12" cy="12" r="8" className="ic-soft" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  note: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" className="ic-soft" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
    </>
  ),
  play: (
    <path d="M6.5 4.5 19 12l-12.5 7.5V4.5Z" className="ic-soft" />
  ),
  pause: (
    <>
      <rect x="5" y="4" width="5" height="16" rx="1.5" className="ic-soft" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" className="ic-soft" />
    </>
  ),
  stop: (
    <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" className="ic-soft" />
  ),
  lightning: (
    <path d="M13.5 2.5 5.5 13h7.5L10 21.5 19 11h-7.5Z" className="ic-soft" />
  ),
  palmtree: (
    <>
      <path d="M13 22c0-4-1-8-1-12" />
      <path d="M12 10C9 8 6 6 4 3c3.5-.5 8 2 8 7Z" className="ic-soft" />
      <path d="M12 10c3-2 6-4 8-7-3.5-.5-8 2-8 7Z" className="ic-soft" />
      <path d="M12 8c-1-3 0-5 2-7-3 1-4 4-2 7Z" className="ic-soft" />
    </>
  ),
  door: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" className="ic-soft" />
      <circle cx="15.5" cy="12" r="1" />
    </>
  ),
}

interface IconProps {
  name: string
  size?: number
  stroke?: number
  soft?: boolean
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 24, stroke = 1.75, soft = true, className = '', style }: IconProps) {
  const body = PATHS[name] ?? PATHS.spark
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mi-icon${soft ? '' : ' mi-no-soft'}${className ? ' ' + className : ''}`}
      style={style}
      aria-hidden="true"
    >
      {body}
    </svg>
  )
}
