// src/app/credits/page.tsx
import { supabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CreditsPageClient from './CreditsPageClient';

export default async function CreditsPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If not logged in, send them to auth
  if (!session?.user) {
    redirect('/auth/login'); // use your actual login route if different
  }

  // Pass only what the client needs
  return (
    <CreditsPageClient
      user={{
        id: session.user.id,
        email: session.user.email ?? '',
      }}
    />
  );
}
