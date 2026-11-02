interface Props {
  title: string
  phase: number
  description: string
}

export function NotImplemented({ title, phase, description }: Props) {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3 pt-[12vh]">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted leading-relaxed">{description}</p>
      <p className="border-line text-muted mt-2 border-l-2 pl-4 text-sm">
        Not implemented yet. This page is built in Phase {phase}.
      </p>
    </section>
  )
}
