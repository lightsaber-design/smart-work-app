interface MinistryMarkProps {
  size?: number;
  pinColor?: string;
  accentColor?: string;
  dialColor?: string;
  romanColor?: string;
  className?: string;
}

export function MinistryMark({
  size = 120,
  // Por defecto hereda el color de texto (currentColor): oscuro en modo claro y
  // claro en modo nocturno, para que el icono siempre tenga contraste.
  pinColor = "currentColor",
  accentColor = "hsl(199 89% 48%)",
  // La esfera sigue el tema (clara en modo claro, oscura en modo nocturno) para que
  // sea la inversa real del icono y los números/agujas (currentColor) siempre contrasten.
  dialColor = "hsl(var(--card))",
  romanColor,
  className,
}: MinistryMarkProps) {
  const rc = romanColor ?? pinColor;
  const cx = 100, cy = 92, r = 32;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="Ministry Log"
    >
      {/* ring at top of pin (the crown/bail) */}
      <circle cx="100" cy="30" r="7" fill="none" stroke={pinColor} strokeWidth="5" />
      {/* elongated pin body */}
      <path
        d="M100 44 C 62 44, 48 76, 48 96 C 48 130, 92 170, 100 184 C 108 170, 152 130, 152 96 C 152 76, 138 44, 100 44 Z"
        fill={pinColor}
      />
      {/* clock dial */}
      <circle cx={cx} cy={cy} r={r} fill={dialColor} />
      {/* subtle inner ring */}
      <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke={rc} strokeWidth="0.8" opacity="0.25" />
      {/* Roman numerals */}
      <text x={cx}     y={cy - r + 10} fontFamily="Cormorant Garamond, Georgia, serif" fontSize="9" fontWeight="700" fill={rc} textAnchor="middle">XII</text>
      <text x={cx + r - 6} y={cy + 3}  fontFamily="Cormorant Garamond, Georgia, serif" fontSize="9" fontWeight="700" fill={rc} textAnchor="middle">III</text>
      <text x={cx}     y={cy + r - 3}  fontFamily="Cormorant Garamond, Georgia, serif" fontSize="9" fontWeight="700" fill={rc} textAnchor="middle">VI</text>
      <text x={cx - r + 6} y={cy + 3}  fontFamily="Cormorant Garamond, Georgia, serif" fontSize="9" fontWeight="700" fill={rc} textAnchor="middle">IX</text>
      {/* minute tick marks */}
      {[1,2,4,5,7,8,10,11].map((h) => {
        const a = (h * 30 - 90) * Math.PI / 180;
        return (
          <line
            key={h}
            x1={cx + Math.cos(a) * (r - 3)}
            y1={cy + Math.sin(a) * (r - 3)}
            x2={cx + Math.cos(a) * (r - 6)}
            y2={cy + Math.sin(a) * (r - 6)}
            stroke={rc}
            strokeWidth="0.8"
            opacity="0.5"
          />
        );
      })}
      {/* hands (10:10 position) */}
      <line x1={cx} y1={cy} x2={cx - 12} y2={cy - 8} stroke={rc} strokeWidth="2.4" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + 12} y2={cy - 8} stroke={rc} strokeWidth="2.4" strokeLinecap="round" />
      {/* center dot in accent color */}
      <circle cx={cx} cy={cy} r="2.5" fill={accentColor} />
    </svg>
  );
}

interface MinistryWordmarkProps {
  size?: number;
  baseColor?: string;
  accentColor?: string;
  showUnderline?: boolean;
  className?: string;
}

export function MinistryWordmark({
  size = 32,
  baseColor = "currentColor",
  accentColor = "hsl(199 89% 48%)",
  showUnderline = false,
  className,
}: MinistryWordmarkProps) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: size, letterSpacing: "-0.02em", lineHeight: 1 }}>
        <span style={{ fontWeight: 400, color: baseColor }}>Ministry</span>
        <span style={{ fontWeight: 700, color: accentColor }}>Log</span>
      </span>
      {showUnderline && (
        <div style={{ width: size * 1.5, height: 2, background: accentColor, borderRadius: 1 }} />
      )}
    </div>
  );
}
