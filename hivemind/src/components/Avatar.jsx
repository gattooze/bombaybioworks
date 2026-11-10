import { initials, avatarColor } from '../lib/utils.js';

export default function Avatar({ name, size = 36 }) {
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center text-white font-semibold"
      style={{ width: size, height: size, background: avatarColor(name || '?'), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}
