import type { ReactElement, ReactNode } from 'react';

/** Pictogramas de los 14 alérgenos de declaración obligatoria (UE). */

type GlyphProps = {
  size?: number;
  className?: string;
};

function Svg({
  children,
  size = 28,
  className,
  label,
}: GlyphProps & { children: ReactNode; label: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      role="img"
    >
      <title>{label}</title>
      {children}
    </svg>
  );
}

/** Espiga de cereal — gluten. */
function GlutenGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Gluten">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 8c0 0-1.2 4.5-1.2 8.2 0 2.2.4 4.2 1.2 5.8.8-1.6 1.2-3.6 1.2-5.8C25.2 12.5 24 8 24 8zm-5.2 6.5c.9 1.6 1.5 3.5 1.5 5.5 0 1.8-.4 3.4-1.1 4.7 1.4-.6 2.6-1.8 3.4-3.4-.2-2.4-1.4-4.8-3.8-6.8zm10.4 0c-2.4 2-3.6 4.4-3.8 6.8.8 1.6 2 2.8 3.4 3.4-.7-1.3-1.1-2.9-1.1-4.7 0-2 .6-3.9 1.5-5.5zM18.5 22c1.1 1.3 1.8 3 1.8 4.8 0 1.5-.4 2.8-1 3.9 1.5-.4 2.8-1.4 3.7-2.8-.1-2.1-1.4-4.2-4.5-5.9zm11 0c-3.1 1.7-4.4 3.8-4.5 5.9.9 1.4 2.2 2.4 3.7 2.8-.6-1.1-1-2.4-1-3.9 0-1.8.7-3.5 1.8-4.8zM24 24.5c-1.8 1.8-2.8 4-2.8 6.3 0 2.2.7 4 1.8 5.4.4.1.7.1 1 .1s.6 0 1-.1c1.1-1.4 1.8-3.2 1.8-5.4 0-2.3-1-4.5-2.8-6.3z"
      />
    </Svg>
  );
}

function CrustaceosGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Crustáceos">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 14c-4.8 0-8.5 3.2-9.2 7.4-.3 1.8.2 3.5 1.2 4.8l-2.8 2.2 1.4 1.8 3.1-2.4c1.5 1.2 3.4 1.9 5.5 2.1v3.6h2.4v-3.6c2.1-.2 4-.9 5.5-2.1l3.1 2.4 1.4-1.8-2.8-2.2c1-1.3 1.5-3 1.2-4.8C32.5 17.2 28.8 14 24 14zm-5.2 8.2c.9 0 1.6.7 1.6 1.6s-.7 1.6-1.6 1.6-1.6-.7-1.6-1.6.7-1.6 1.6-1.6zm10.4 0c.9 0 1.6.7 1.6 1.6s-.7 1.6-1.6 1.6-1.6-.7-1.6-1.6.7-1.6 1.6-1.6z"
      />
    </Svg>
  );
}

function HuevosGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Huevos">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="24" cy="25" rx="9" ry="12" fill="currentColor" />
      <ellipse cx="24" cy="27" rx="4.5" ry="5" fill="#fff" opacity="0.35" />
    </Svg>
  );
}

function PescadoGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Pescado">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M10 24c6.5-8 14-10 22-8-1.2 2.4-1.8 5-1.8 8s.6 5.6 1.8 8c-8 2-15.5 0-22-8zm22-6.5 5.5 6.5-5.5 6.5V17.5zM18.5 21.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"
      />
    </Svg>
  );
}

function CacahuetesGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Cacahuetes">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M18.2 13.5c-3.2 0-5.7 2.7-5.7 6.2 0 2.2 1 4.1 2.5 5.2-.2.5-.3 1-.3 1.6 0 3.5 2.5 6.2 5.7 6.2 1.8 0 3.4-.9 4.5-2.3 1.1 1.4 2.7 2.3 4.5 2.3 3.2 0 5.7-2.7 5.7-6.2 0-.6-.1-1.1-.3-1.6 1.5-1.1 2.5-3 2.5-5.2 0-3.5-2.5-6.2-5.7-6.2-1.8 0-3.4.9-4.5 2.3-1.1-1.4-2.7-2.3-4.5-2.3zm.8 3.2c1.4 0 2.5 1.4 2.5 3.2s-1.1 3.2-2.5 3.2-2.5-1.4-2.5-3.2 1.1-3.2 2.5-3.2zm10 0c1.4 0 2.5 1.4 2.5 3.2s-1.1 3.2-2.5 3.2-2.5-1.4-2.5-3.2 1.1-3.2 2.5-3.2zM20.5 28c1.2 0 2.2 1.1 2.2 2.5s-1 2.5-2.2 2.5-2.2-1.1-2.2-2.5 1-2.5 2.2-2.5zm7 0c1.2 0 2.2 1.1 2.2 2.5s-1 2.5-2.2 2.5-2.2-1.1-2.2-2.5 1-2.5 2.2-2.5z"
      />
    </Svg>
  );
}

function SojaGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Soja">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 10c-1.2 4-1.2 8.5 0 12.5 1.2-4 1.2-8.5 0-12.5zm-7.5 5.5c2.8 2.2 5.2 5.2 6.8 8.8-3.6-1.6-6.6-4-8.8-6.8 1.1-.4 1.6-1.2 2-2zm15 0c.4.8.9 1.6 2 2-2.2 2.8-5.2 5.2-8.8 6.8 1.6-3.6 4-6.6 6.8-8.8zM16 28.5c2.5-.2 5-.8 7.2-2-1.5 3.2-3.8 5.8-6.8 7.5-.3-1.9-.5-3.7-.4-5.5zm16 0c.1 1.8-.1 3.6-.4 5.5-3-1.7-5.3-4.3-6.8-7.5 2.2 1.2 4.7 1.8 7.2 2z"
      />
    </Svg>
  );
}

function LacteosGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Lácteos">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M18 12h12l2 4v18H16V16l2-4zm2.4 2.4-.8 1.6h9l-.8-1.6h-7.4zM18.5 20h11v12h-11V20z"
      />
      <path fill="currentColor" d="M21 23h6v2h-6zm0 4h6v2h-6z" opacity="0.45" />
    </Svg>
  );
}

function FrutosCascaraGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Frutos de cáscara">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 11c-6.2 0-10.5 4.2-10.5 9.8 0 5.2 3.6 9.2 8.2 10.5.6.2 1.2-.3 1.2-.9V28c0-1.4.6-2.6 1.1-3.5.4-.7 1.1-1.5 1.1-2.4 0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6h-2.4c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.6-1 2.8-1.7 3.8-.6.9-1.1 1.8-1.1 2.7v2.4c0 .6.6 1.1 1.2.9 4.6-1.3 8.2-5.3 8.2-10.5C34.5 15.2 30.2 11 24 11z"
      />
    </Svg>
  );
}

function ApioGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Apio">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M22.2 10.5c-1.2 3.5-1.4 7.5-.8 11.2-.9-.4-1.8-.6-2.7-.6-1.8 0-3.4.8-4.5 2.1 2.2 1.4 4.8 2.2 7.6 2.2.4 0 .8 0 1.2-.1.2 3.2.8 6.2 1.8 8.7l2.2-.8c-.9-2.2-1.5-4.8-1.7-7.6 2.6-.5 4.8-1.8 6.4-3.6-1.4-1-3.1-1.6-5-1.6-.8 0-1.5.1-2.2.4.2-3.4.8-6.8 2.2-9.8l-2.3-1.1c-.7 1.4-1.2 2.9-1.6 4.4-.3-1.5-.7-3-1.4-4.4l-2.2 1.2z"
      />
    </Svg>
  );
}

function MostazaGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Mostaza">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="24" cy="18" r="3.2" fill="currentColor" />
      <circle cx="17.5" cy="22.5" r="3.2" fill="currentColor" />
      <circle cx="30.5" cy="22.5" r="3.2" fill="currentColor" />
      <circle cx="20" cy="30" r="3.2" fill="currentColor" />
      <circle cx="28" cy="30" r="3.2" fill="currentColor" />
      <circle cx="24" cy="24.5" r="2.2" fill="currentColor" opacity="0.55" />
    </Svg>
  );
}

function SesamoGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Sésamo">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="16" cy="18" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(-25 16 18)" />
      <ellipse cx="24" cy="15" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(8 24 15)" />
      <ellipse cx="32" cy="18" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(28 32 18)" />
      <ellipse cx="18" cy="27" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(-12 18 27)" />
      <ellipse cx="26.5" cy="26" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(18 26.5 26)" />
      <ellipse cx="22" cy="34" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(-5 22 34)" />
      <ellipse cx="31" cy="30" rx="2.2" ry="3.4" fill="currentColor" transform="rotate(22 31 30)" />
    </Svg>
  );
}

function SulfitosGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Sulfitos">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M20 11h8v3h-1.5v2.2c3.2.8 5.5 3.6 5.5 7 0 1.4-.4 2.7-1.1 3.8l2.3 2.3-1.7 1.7-2.2-2.2A7.9 7.9 0 0 1 24 31.2a7.9 7.9 0 0 1-5.3-2.1l-2.2 2.2-1.7-1.7 2.3-2.3A7.7 7.7 0 0 1 16 23.2c0-3.4 2.3-6.2 5.5-7V14H20v-3zm4 8.2c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"
      />
    </Svg>
  );
}

function AltramucesGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Altramuces">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 9c-1.5 3.5-2.2 7-2.2 10.5h4.4C26.2 16 25.5 12.5 24 9zm-6.5 8.5c-2.8 2.2-4.5 5-4.5 8.2 2.8-.4 5.5-1.5 7.8-3.2-1.4-2-2.6-3.6-3.3-5zm13 0c-.7 1.4-1.9 3-3.3 5 2.3 1.7 5 2.8 7.8 3.2 0-3.2-1.7-6-4.5-8.2zM17.8 29.5c.8 2.8 2.4 5.2 4.7 6.8V28c-1.7.3-3.3.8-4.7 1.5zm12.4 0c-1.4-.7-3-1.2-4.7-1.5v8.3c2.3-1.6 3.9-4 4.7-6.8z"
      />
    </Svg>
  );
}

function MoluscosGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Moluscos">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 12c-8.5 0-14 6.2-14 12.5 0 1.8.5 3.4 1.3 4.8 2.2-3.5 6.8-6 12.7-6s10.5 2.5 12.7 6c.8-1.4 1.3-3 1.3-4.8C38 18.2 32.5 12 24 12zm0 8c-4.2 0-8 1.6-10.5 4.1C15.8 27.8 19.6 30 24 30s8.2-2.2 10.5-5.9C32 21.6 28.2 20 24 20zm0 3.2c1.8 0 3.2 1.2 3.2 2.8S25.8 28.8 24 28.8 20.8 27.6 20.8 26s1.4-2.8 3.2-2.8z"
      />
    </Svg>
  );
}

function GenericGlyph(props: GlyphProps) {
  return (
    <Svg {...props} label="Alérgeno">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M24 12c-1.2 0-2.1.9-2.1 2.2v11.2c0 1.2.9 2.1 2.1 2.1s2.1-.9 2.1-2.1V14.2c0-1.3-.9-2.2-2.1-2.2zm0 18.2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"
      />
    </Svg>
  );
}

const GLYPH_BY_KEY: Record<string, (props: GlyphProps) => ReactElement> = {
  gluten: GlutenGlyph,
  crustaceos: CrustaceosGlyph,
  huevos: HuevosGlyph,
  pescado: PescadoGlyph,
  cacahuetes: CacahuetesGlyph,
  soja: SojaGlyph,
  lacteos: LacteosGlyph,
  'frutos de cascara': FrutosCascaraGlyph,
  apio: ApioGlyph,
  mostaza: MostazaGlyph,
  sesamo: SesamoGlyph,
  sulfitos: SulfitosGlyph,
  altramuces: AltramucesGlyph,
  moluscos: MoluscosGlyph,
};

function normalizeAllergenKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function AllergenGlyph({ name, size = 28, className }: GlyphProps & { name: string }) {
  const key = normalizeAllergenKey(name);
  const Glyph = GLYPH_BY_KEY[key] ?? GenericGlyph;
  return <Glyph size={size} className={className} />;
}
