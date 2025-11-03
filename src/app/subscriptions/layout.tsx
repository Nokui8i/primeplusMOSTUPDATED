import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Subscriptions | PrimePlus',
  description: 'View and manage your creator subscriptions',
};

export default function SubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <main className={`py-0 md:py-8 px-0 md:px-4`}>
        {children}
      </main>
    </div>
  );
} 