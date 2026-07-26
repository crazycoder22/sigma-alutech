import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { ProductsGrid } from '@/components/ProductsGrid';
import { Enquiry } from '@/components/Enquiry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Technal-certified aluminium windows, doors, sliding systems, facades, balustrades and hardware from Sigma Alutech, Bangalore.',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [categories, params] = await Promise.all([getCatalog(), searchParams]);

  return (
    <>
      <section className="container">
        <div className="page-intro">
          <span className="eyebrow">Our products</span>
          <h1 className="page-intro__title">Premium aluminium systems</h1>
          <p className="page-intro__lead">
            Technal-certified windows, doors, facades and balustrades — engineered for
            performance and beauty.
          </p>
        </div>

        <ProductsGrid categories={categories} initialCategory={params.category} />
      </section>

      <Enquiry />
    </>
  );
}
