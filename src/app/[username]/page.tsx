import { redirect } from 'next/navigation';

export default function UsernameRedirectPage({ params }: { params: { username: string } }) {
  redirect(`/profile/${params.username}`);
  return null;
} 