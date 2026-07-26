'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProjectCategoryDto, ProjectDto } from '@/lib/types';

interface Props {
  categories: ProjectCategoryDto[];
  projects: ProjectDto[];
}

export function ProjectsGrid({ categories, projects }: Props) {
  const [active, setActive] = useState('all');

  const visible = [...projects]
    .sort((a, b) => b.year - a.year)
    .filter((p) => active === 'all' || p.categorySlug === active);

  return (
    <>
      <div className="filter-band">
        <div className="container">
          <div className="filters" id="projectFilters">
            <button
              className={`filter-btn${active === 'all' ? ' active' : ''}`}
              data-category="all"
              onClick={() => setActive('all')}
            >
              All projects
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                className={`filter-btn${active === c.slug ? ' active' : ''}`}
                data-category={c.slug}
                onClick={() => setActive(c.slug)}
              >
                {c.name}
              </button>
            ))}
            <span className="filters__count">
              {visible.length} project{visible.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="card-grid card-grid--projects" id="projectsGrid">
            {visible.map((project) => (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}`}
                className="media media--zoom project-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.thumbnail} alt={project.name} loading="lazy" />
                <div className="media__scrim"></div>
                <div className="media__caption">
                  <div className="project-card__row">
                    <span className="project-card__category">{project.categoryName}</span>
                    <span className="project-card__year">{project.year}</span>
                  </div>
                  <span className="project-card__name">{project.name}</span>
                  <span className="project-card__place">{project.location}</span>
                </div>
              </Link>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="no-results">
              <div className="no-results__icon">⌕</div>
              <p>No projects in this category yet.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
