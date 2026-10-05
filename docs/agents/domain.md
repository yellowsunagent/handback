# Domain docs

This repo uses a single-context layout.

## Before exploring

- Read root `GLOSSARY.md` for domain vocabulary.
- Read relevant decisions in root `docs/adr/`.
- Consult `PRD.md` for agreed requirements and `IMPLEMENTATION.md`
  for implementation decisions and verification history.

If the glossary or ADRs do not exist, proceed silently. Do not flag
their absence or suggest creating them upfront. The `domain-modeling`
skill creates them lazily when terms or decisions are resolved.

## File structure

- `GLOSSARY.md`: shared domain vocabulary.
- `docs/adr/NNNN-short-description.md`: architecture decision records.
- `app/src/`: application source.

Preserve the existing requirements and implementation documents.
Do not create empty glossary or ADR placeholders during setup.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, proposals, hypotheses,
and test names. Avoid synonyms the glossary explicitly rejects.

If a needed concept is missing, reconsider whether it belongs in
the domain or note the gap for `domain-modeling`.

## Flag ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR,
cite the decision, and explain why it may warrant reconsideration.
Do not silently override it.
