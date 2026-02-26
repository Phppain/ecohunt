import { MessageCircle } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';

export default function ChatPlaceholder() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 pb-24">
      <EcoCard variant="elevated" className="text-center p-8 max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Community Chat</h2>
        <p className="text-sm text-muted-foreground">
          Chat with other eco-warriors in your area. Coming soon!
        </p>
      </EcoCard>
    </div>
  );
}
