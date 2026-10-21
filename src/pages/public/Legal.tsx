import { useEffect } from 'react'
import { Container, PageHero, useSite } from '../../components/layout'
import { LoadingBlock } from '../../components/ui/primitives'
import { RichText } from '../../components/race/RichText'

export default function Legal() {
  const { footer } = useSite()
  useEffect(() => {
    document.title = 'Mentions & confidentialité — BLACKLANE'
  }, [])
  return (
    <>
      <PageHero kicker="Informations" title="Mentions légales" />
      <Container className="max-w-3xl space-y-10 py-12">
        {!footer ? (
          <LoadingBlock rows={4} />
        ) : (
          <>
            <section>
              <h2 className="display mb-3 text-3xl text-bone">Univers fictif</h2>
              <RichText text={footer.disclaimer} />
            </section>
            <section>
              <h2 className="display mb-3 text-3xl text-bone">Éditeur et hébergement</h2>
              <RichText text={footer.legal} />
            </section>
            <section>
              <h2 className="display mb-3 text-3xl text-bone">Confidentialité</h2>
              <RichText text={footer.privacy} />
            </section>
          </>
        )}
      </Container>
    </>
  )
}
