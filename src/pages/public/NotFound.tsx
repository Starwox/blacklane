import { Container } from '../../components/layout'
import { LinkButton } from '../../components/ui/Button'

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-start justify-center pb-20 pt-32">
      <p className="kicker mb-4">Erreur 404</p>
      <h1 className="display text-7xl text-bone sm:text-8xl">Hors piste.</h1>
      <p className="mt-4 max-w-lg text-ash">Cette page n’existe pas — ou elle n’a jamais existé. Blacklane ne laisse pas de traces.</p>
      <LinkButton to="/" className="mt-8">Retour à l’accueil</LinkButton>
    </Container>
  )
}
