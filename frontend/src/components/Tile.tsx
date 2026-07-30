import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

interface TileProps {
  to?: string;
  onClick?: () => void;
  label: string;
  accent: string;
  cta: string;
  children: ReactNode;
}

export function Tile({ to, onClick, label, accent, cta, children }: TileProps) {
  const style = { "--tile-accent": accent } as CSSProperties;
  const content = (
    <>
      <div>
        <div className="tile-label">{label}</div>
        <div className="tile-snapshot">{children}</div>
      </div>
      <div className="tile-cta">{cta} &gt;&gt;</div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="tile" style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="tile" style={style} onClick={onClick}>
      {content}
    </button>
  );
}
