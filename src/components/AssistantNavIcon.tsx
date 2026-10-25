import assistantIcon from '@/assets/aqua-assistant-icon.png';
export default function AssistantNavIcon({ className = '' }: { className?: string }) {
  return <img src={assistantIcon} alt="" width={32} height={32} loading="lazy" className={`shrink-0 object-contain ${className}`} />;
}