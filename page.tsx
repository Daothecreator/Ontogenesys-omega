import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { QuantumFieldGenerator } from '@/components/resonator/QuantumFieldGenerator';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return <QuantumFieldGenerator />;
}
