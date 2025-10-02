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
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        {children}
      </main>
    </div>
  );
} 