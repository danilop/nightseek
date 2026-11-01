import guideStar from '@/assets/nightseek.svg';

export default function NightSeekIcon({ className }: { className?: string }) {
  return (
    <img
      src={guideStar}
      className={className}
      width={100}
      height={100}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
