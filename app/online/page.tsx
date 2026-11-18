import Header from '@/components/Header';
import { useTranslation } from '@/lib/i18n';
import OnlineMatchmaking from '@/components/OnlineMatchmaking';

export default function OnlinePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <OnlineMatchmaking />
    </div>
  );
}
