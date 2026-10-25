import { UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export default function ProfileAvatar({ src, name, className = '' }: { src?: string | null; name?: string; className?: string }) {
  return <Avatar className={`shrink-0 ring-1 ring-border ${className}`}><AvatarImage src={src || undefined} alt={name ? `Photo de ${name}` : 'Photo de profil'} className="object-cover" /><AvatarFallback className="bg-accent text-accent-foreground"><UserRound className="h-3/5 w-3/5" strokeWidth={1.5} aria-label="Avatar de profil par défaut" /></AvatarFallback></Avatar>;
}