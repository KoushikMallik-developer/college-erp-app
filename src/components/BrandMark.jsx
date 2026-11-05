import { GraduationCap } from 'lucide-react';

// Graduation cap on a rounded brand-blue tile.
export default function BrandMark({ size = 32 }) {
  return (
    <span className="brand-mark" aria-hidden="true" style={{ width: size, height: size, display: 'grid', placeItems: 'center', background: 'var(--brand)', borderRadius: size * 0.29, color: 'var(--white)' }}>
      <GraduationCap size={size * 0.62} />
    </span>
  );
}
