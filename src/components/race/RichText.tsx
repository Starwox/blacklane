// Rendu sûr d'un texte simple : paragraphes séparés par une ligne vide,
// listes introduites par « - », mise en gras **ainsi**. Aucun HTML n'est interprété.
import { Fragment, type ReactNode } from 'react'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  return (
    <div className={className ?? 'prose-bl'}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '')
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
