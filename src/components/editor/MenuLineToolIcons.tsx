/** Icono de conversión texto → línea de carta. */

export function MenuLineConvertIcon() {
  return (
    <svg
      width={28}
      height={14}
      viewBox="0 0 28 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable={false}
      className="toolbar-menu-line-icon toolbar-menu-line-icon--svg"
    >
      <path
        d="M1.5 7h5.5M5.2 4.2 8.5 7l-3.3 2.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11" y="5" width="5.5" height="4" rx="1" fill="currentColor" opacity="0.9" />
      <circle cx="18.5" cy="7" r="0.8" fill="currentColor" opacity="0.55" />
      <circle cx="20.5" cy="7" r="0.8" fill="currentColor" opacity="0.55" />
      <circle cx="22.5" cy="7" r="0.8" fill="currentColor" opacity="0.55" />
      <text
        x="27"
        y="10.2"
        textAnchor="end"
        fill="currentColor"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        €
      </text>
    </svg>
  );
}
