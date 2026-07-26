import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { ProductsGrid } from '@/components/ProductsGrid';

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
      <section className="intro-band">
        <div className="container intro-band__grid">
          <div className="intro-band__head">
            <span className="eyebrow">Our products</span>
            <h1 className="intro-band__title">Premium aluminium systems</h1>
          </div>
          <p className="intro-band__lead">
            A comprehensive range of Technal-certified aluminium solutions. From windows
            and doors to facades and balustrades — engineered for performance and beauty.
          </p>
        </div>
      </section>

      <ProductsGrid categories={categories} initialCategory={params.category} />
    </>
  );
}
