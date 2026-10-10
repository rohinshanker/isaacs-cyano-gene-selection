# Internal documentation links

Before renaming or deleting a ticket or validation document, find its incoming
Markdown links with `rg` and redirect them to the durable section that preserves
the same decision, evidence boundary, or operating rule. Do not recreate a
resolved ticket solely as a link destination. In frozen handoffs, preserve the
historical claims and wording; change only destinations and necessary short
labels.

Check every relative link in the affected documents, including same-document
`#fragment` links. Resolve paths from the source document's directory, decode
URL escapes, and verify that the target exists. For fragments, check GitHub-style
heading slugs, repeated-heading suffixes, and explicit HTML `id`/`name` anchors.
A renamed heading can retain an explicit anchor for old links; a heading-only
checker would incorrectly flag it. Confirm the linked section carries the
intended content as well as having a matching anchor.

Repeat this check after resolved-ticket cleanup, including the ticket index and
any remaining tickets that linked to the retired work. Run `git diff --check`
and the repository gates in [AGENTS.md](../../AGENTS.md) before completion.
