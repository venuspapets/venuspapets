import RecoverForm from './RecoverForm';

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <RecoverForm expired={error === 'enlace'} />;
}
