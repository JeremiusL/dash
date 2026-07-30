import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

interface TileProps {
  to: string;
  label: string;
  accent: string;
  cta: string;
  children: ReactNode;
}

export function Tile({ to, label, accent, cta, children }: TileProps) {
  const style = { "--tile-accent": accent } as CSSProperties;
  return (
    <Link to={to} className="tile" style={style}>
      <div>
        <div className="tile-label">{label}</div>
        <div className="tile-snapshot">{children}</div>
      </div>
      <div className="tile-cta">{cta} &gt;&gt;</div>
    </Link>
  );
}
