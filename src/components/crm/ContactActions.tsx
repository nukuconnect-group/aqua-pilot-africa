import { Mail, MessageCircle, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toWhatsappNumber, whatsappLink } from '@/lib/whatsappReminder';

interface ContactActionsProps {
  name: string;
  phone?: string;
  email?: string;
  message: string;
}

export default function ContactActions({ name, phone = '', email = '', message }: ContactActionsProps) {
  const number = phone.trim() ? toWhatsappNumber(phone) : '';
  const actions = [
    { label: 'Relancer sur WhatsApp', icon: MessageCircle, href: number ? whatsappLink(number, message) : '', external: true },
    { label: 'Relancer par SMS', icon: MessageSquare, href: number ? `sms:+${number}?body=${encodeURIComponent(message)}` : '' },
    { label: 'Relancer par email', icon: Mail, href: email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Prise de contact')}&body=${encodeURIComponent(message)}` : '' },
    { label: 'Appeler', icon: Phone, href: number ? `tel:+${number}` : '' },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1" aria-label={`Contacter ${name}`}>
        {actions.map(({ label, icon: Icon, href, external }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              {href ? (
                <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                  <a href={href} aria-label={`${label} : ${name}`} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
                    <Icon className="h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <span tabIndex={0} aria-label={`${label} : coordonnées manquantes`}>
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled aria-label={label}>
                    <Icon className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>{href ? label : `${label} — coordonnées manquantes`}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}