'use client';

import { useEffect, useState } from 'react';
import type { ProjectCategoryDto, ProjectDto } from '@/lib/types';
import { titleCase } from '@/lib/types';

interface Props {
  categories: ProjectCategoryDto[];
  projects: ProjectDto[];
}

export function ProjectsShowcase({ categories, projects }: Props) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [openProject, setOpenProject] = useState<ProjectDto | null>(null);
  const [mainImage, setMainImage] = useState('');
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    const locked = Boolean(openProject) || Boolean(lightbox);
    document.body.classList.toggle('no-scroll', locked);
    return () => document.body.classList.remove('no-scroll');
  }, [openProject, lightbox]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null);
        else setOpenProject(null);
      }
      if (lightbox) {
        if (e.key === 'ArrowLeft') {
          setLightbox((lb) =>
            lb ? { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length } : lb
          );
        }
        if (e.key === 'ArrowRight') {
          setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.images.length } : lb));
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  function open(project: ProjectDto) {
    setOpenProject(project);
    setMainImage(project.images[0] ?? project.thumbnail);
  }

  function openLightbox() {
    if (!openProject) return;
    const images = openProject.images.length ? openProject.images : [openProject.thumbnail];
    const clicked = images.indexOf(mainImage);
    setLightbox({ images, index: clicked >= 0 ? clicked : 0 });
    setOpenProject(null);
  }

  const sorted = [...projects].sort((a, b) => b.year - a.year);
  const visible = sorted.filter(
    (p) => activeCategory === 'all' || p.categorySlug === activeCategory
  );

  return (
    <>
      <div className="filters" id="projectFilters">
        <button
          className={`filter-btn${activeCategory === 'all' ? ' active' : ''}`}
          data-category="all"
          onClick={() => setActiveCategory('all')}
        >
          All Projects
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            className={`filter-btn${activeCategory === cat.slug ? ' active' : ''}`}
            data-category={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="projects-grid" id="projectsGrid">
        {visible.map((project) => (
          <div key={project.slug} className="project-card" onClick={() => open(project)}>
            { }
            <img
              className="project-card__image"
              src={project.thumbnail}
              alt={project.name}
              loading="lazy"
            />
            <div className="project-card__overlay">
              <div className="project-card__category">{project.type}</div>
              <div className="project-card__name">{project.name}</div>
              <div className="project-card__meta">
                {project.location} &bull; {project.year}
              </div>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="no-results">
          <div className="no-results__icon">&#128269;</div>
          <p>No projects found in this category.</p>
        </div>
      ) : null}

      {/* Project Modal */}
      <div
        className={`modal-backdrop${openProject ? ' open' : ''}`}
        onClick={() => setOpenProject(null)}
      ></div>
      <div className={`modal${openProject ? ' open' : ''}`} id="projectModal">
        {openProject ? (
          <>
            <button className="modal__close" onClick={() => setOpenProject(null)}>
              &times;
            </button>
            <div className="modal__image-container">
              { }
              <img
                src={mainImage}
                alt={openProject.name}
                style={{ cursor: 'pointer' }}
                onClick={openLightbox}
              />
            </div>
            {openProject.images.length > 1 ? (
              <div className="modal__gallery">
                {openProject.images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    className={`modal__gallery-thumb${img === mainImage ? ' active' : ''}`}
                    src={img}
                    alt={`${openProject.name} - Image ${i + 1}`}
                    loading="lazy"
                    onClick={() => setMainImage(img)}
                  />
                ))}
              </div>
            ) : null}
            <div className="modal__body">
              <div className="modal__tags">
                <span className="modal__tag">{openProject.categoryName}</span>
                {openProject.productsUsed.map((p) => (
                  <span key={p} className="modal__tag">{titleCase(p)}</span>
                ))}
              </div>
              <h3 className="modal__title">{openProject.name}</h3>
              <p className="modal__description">{openProject.description}</p>

              <div className="modal__details">
                {openProject.location ? (
                  <div>
                    <div className="modal__detail-label">Location</div>
                    <div className="modal__detail-value">{openProject.location}</div>
                  </div>
                ) : null}
                <div>
                  <div className="modal__detail-label">Year</div>
                  <div className="modal__detail-value">{openProject.year}</div>
                </div>
                {openProject.type ? (
                  <div>
                    <div className="modal__detail-label">Project Type</div>
                    <div className="modal__detail-value">{openProject.type}</div>
                  </div>
                ) : null}
                {openProject.architect ? (
                  <div>
                    <div className="modal__detail-label">Architect</div>
                    <div className="modal__detail-value">{openProject.architect}</div>
                  </div>
                ) : null}
              </div>

              {openProject.videoUrl ? (
                <>
                  <h4 className="modal__section-heading">Project Video</h4>
                  <div className="video-container">
                    <iframe src={openProject.videoUrl} allowFullScreen loading="lazy"></iframe>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Lightbox */}
      <div
        className={`lightbox${lightbox ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLightbox(null);
        }}
      >
        {lightbox ? (
          <>
            <button className="lightbox__close" onClick={() => setLightbox(null)}>
              &times;
            </button>
            <button
              className="lightbox__nav lightbox__prev"
              onClick={() =>
                setLightbox({
                  ...lightbox,
                  index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
                })
              }
            >
              &#10094;
            </button>
            { }
            <img
              className="lightbox__image"
              src={lightbox.images[lightbox.index]}
              alt={`Project image ${lightbox.index + 1}`}
            />
            <button
              className="lightbox__nav lightbox__next"
              onClick={() =>
                setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length })
              }
            >
              &#10095;
            </button>
            <div className="lightbox__counter">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
