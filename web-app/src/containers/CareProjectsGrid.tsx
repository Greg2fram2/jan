import { Link } from '@tanstack/react-router'
import { MessageCircleIcon } from 'lucide-react'
import { route } from '@/constants/routes'
import {
  filterCareProjectsByProfession,
  useCareProjects,
} from '@/care/projects'
import { useCareActivation } from '@/care/useCareActivation'
import { cn } from '@/lib/utils'

// IA Pros Santé : grille des Projets métier, affichée comme écran d'accueil.
// Chaque carte ouvre le formulaire du Projet ; le chat libre reste accessible
// par le lien discret en dessous.
export default function CareProjectsGrid() {
  const profession = useCareActivation((s) => s.profession)
  const allProjects = useCareProjects((s) => s.projects)
  const projects = filterCareProjectsByProfession(allProjects, profession)
  return (
    <div className="h-full overflow-y-auto px-6 py-10 flex flex-col">
      <div className="mx-auto w-full max-w-3xl my-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-studio font-medium">
            Que souhaitez-vous rédiger&nbsp;?
          </h1>
          <p className="text-sm text-main-view-fg/60 mt-2">
            Choisissez un type de document, remplissez le formulaire, et
            l&rsquo;assistant rédige une première version que vous relisez.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.slug}
              to={route.careProject}
              params={{ slug: project.slug }}
              className={cn(
                'group rounded-lg border border-main-view-fg/10 bg-main-view p-5',
                'transition-colors hover:border-main-view-fg/25 hover:bg-main-view-fg/2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {project.icon ?? '📄'}
                </span>
                <div className="min-w-0">
                  <h2 className="font-medium">{project.name}</h2>
                  <p className="text-sm text-main-view-fg/60 mt-1">
                    {project.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            to={route.careChat}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm text-main-view-fg/60',
              'hover:text-main-view-fg transition-colors'
            )}
          >
            <MessageCircleIcon className="size-4" />
            Ou démarrer une conversation libre
          </Link>
        </div>
      </div>
    </div>
  )
}
