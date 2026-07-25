import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { ProductsCatalog } from '@/components/ProductsCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Products | Sigma Alutech',
  description:
    'Sigma Alutech Products - Premium Technal aluminium windows, doors, sliding systems, facades, balustrades and hardware.',
};

export default async function ProductsPage() {
  const categories = await getCatalog();

  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="section-label">Our Products</span>
          <h1 className="page-header__title">Premium Aluminium Systems</h1>
          <p className="page-header__subtitle">
            A comprehensive range of Technal-certified aluminium solutions. From windows and doors
            to facades and balustrades &mdash; engineered for performance and beauty.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <ProductsCatalog categories={categories} />
        </div>
      </section>
    </>
  );
}
