import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { ProductsAdmin } from '@/components/admin/ProductsAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const session = await getSession();
  if (!session) redirect('/admin');
  const categories = await getCatalog();
  return <ProductsAdmin categories={categories} />;
}
