/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : page formulaire d'un Projet métier (/projet/<slug>).
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import HeaderPage from '@/containers/HeaderPage'
import CareProjectForm from '@/containers/CareProjectForm'
import { getCareProject } from '@/care/projects'
import { route } from '@/constants/routes'

export const Route = createFileRoute(route.careProject as any)({
  component: CareProjectPage,
})

function CareProjectPage() {
  const { slug } = useParams({ from: route.careProject as any }) as {
    slug: string
  }
  const project = getCareProject(slug)

  return (
    <div className="flex h-full flex-col">
      <HeaderPage>
        <Link
          to={route.home}
          className="flex items-center gap-1.5 text-sm text-main-view-fg/60 hover:text-main-view-fg transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          Projets
        </Link>
      </HeaderPage>
      <div className="h-full overflow-y-auto">
        {project ? (
          <CareProjectForm key={project.slug} project={project} />
        ) : (
          <div className="mx-auto max-w-2xl px-6 py-16 text-center">
            <p className="text-main-view-fg/60">
              Ce Projet n&rsquo;existe pas ou n&rsquo;est plus disponible.
            </p>
            <Link
              to={route.home}
              className="inline-block mt-4 text-sm underline underline-offset-4"
            >
              Retour aux Projets
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
