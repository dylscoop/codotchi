---
name: pycharm-docs-parity
description: Enforces parity between pycharm/README.md and the plugin.xml description block — any prose change to one must be mirrored to the other in the same commit.
---

## When to apply this skill

Apply this skill whenever **`pycharm/README.md`** is edited. Any prose change
made to the README must also be reflected in the `<description>` block of
**`pycharm/src/main/resources/META-INF/plugin.xml`**, and vice versa.

| File | Where it appears |
|------|-----------------|
| `pycharm/README.md` | GitHub repository page |
| `pycharm/src/main/resources/META-INF/plugin.xml` (`<description>`) | JetBrains Marketplace plugin page |

---

## The two documents

### `pycharm/README.md`

Plain Markdown. Rendered on GitHub. Uses standard Markdown syntax.

### `plugin.xml` `<description>` block

HTML wrapped in a `<![CDATA[...]]>` section. Rendered on the JetBrains Marketplace.

**Markdown → HTML conversion rules:**

| Markdown | HTML equivalent |
|----------|----------------|
| `## Heading` | `<h2>Heading</h2>` |
| `### Heading` | `<h3>Heading</h3>` |
| `**bold**` | `<b>bold</b>` |
| `- item` / `* item` | `<li>item</li>` inside `<ul>...</ul>` |
| `1. item` | `<li>item</li>` inside `<ol>...</ol>` |
| `[text](url)` | `<a href="url">text</a>` |
| `> blockquote` | `<p><em>text</em></p>` |
| `---` | `<hr/>` |
| Pipe table | `<table><tr><th>…</th></tr><tr><td>…</td></tr></table>` |
| `&` in text | `&amp;` |
| `<` / `>` in text | `&lt;` / `&gt;` |

---

## Workflow

When editing `pycharm/README.md`:

1. Make the change in `pycharm/README.md`.
2. Open `pycharm/src/main/resources/META-INF/plugin.xml`.
3. Locate the `<description><![CDATA[` block.
4. Apply the equivalent change in HTML inside that block.
5. Include both files in the same commit.

When editing `plugin.xml` description first, reverse the direction.

---

## What is NOT mirrored

| Content | Location | Why not mirrored |
|---------|----------|-----------------|
| `<id>`, `<name>`, `<version>`, `<vendor>` | `plugin.xml` only | Metadata, not prose |
| `<idea-version>`, `<depends>`, `<extensions>`, `<actions>` | `plugin.xml` only | Plugin configuration |
| Installation instructions | `pycharm/README.md` only | Marketplace links to GitHub instead |
| Requirements section | Both — keep in sync | Must match |

---

## Sponsor / support content

Sponsor links have been moved to `developer_notes/SPONSOR.md`. Do **not** add them back to either file without explicit user instruction.

---

## Checklist before committing

- [ ] Change applied to `pycharm/README.md`
- [ ] Equivalent change applied to `plugin.xml` `<description>` block
- [ ] HTML in `plugin.xml` is valid (tags closed, `&amp;` used for `&`)
- [ ] Both files staged in the same commit
