# Skill: pycharm-docs-parity

## When to apply this skill

Apply this skill whenever **`pycharm/README.md`** is edited. Any prose change
made to the README must also be reflected in the `<description>` block of
**`pycharm/src/main/resources/META-INF/plugin.xml`**, and vice versa.

These two files are the public-facing docs for the JetBrains plugin:

| File | Where it appears |
|------|-----------------|
| `pycharm/README.md` | GitHub repository page |
| `pycharm/src/main/resources/META-INF/plugin.xml` (`<description>`) | JetBrains Marketplace plugin page |

They must stay in sync at all times.

---

## The two documents

### `pycharm/README.md`

Plain Markdown. Rendered on GitHub. Uses standard Markdown syntax (headers,
tables, bullet lists, bold/italic).

### `plugin.xml` `<description>` block

HTML wrapped in a `<![CDATA[...]]>` section. Rendered on the JetBrains
Marketplace. Uses HTML tags — not Markdown.

**Markdown → HTML conversion rules:**

| Markdown | HTML equivalent |
|----------|----------------|
| `## Heading` | `<h2>Heading</h2>` |
| `### Heading` | `<h3>Heading</h3>` |
| `**bold**` | `<b>bold</b>` |
| `- item` / `* item` | `<li>item</li>` inside `<ul>...</ul>` |
| `1. item` | `<li>item</li>` inside `<ol>...</ol>` |
| `[text](url)` | `<a href="url">text</a>` |
| `> blockquote` | `<p><em>text</em></p>` (use judgment) |
| `---` (horizontal rule) | `<hr/>` |
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

When editing `plugin.xml` description first, reverse the direction: apply the
equivalent change in Markdown to `pycharm/README.md` in the same commit.

---

## What is NOT mirrored

The following sections exist in `plugin.xml` but have no equivalent in the
README, or vice versa — do not try to sync them:

| Content | Location | Why not mirrored |
|---------|----------|-----------------|
| `<id>`, `<name>`, `<version>`, `<vendor>` | `plugin.xml` only | Metadata, not prose |
| `<idea-version>`, `<depends>`, `<extensions>`, `<actions>` | `plugin.xml` only | Plugin configuration |
| Installation instructions | `pycharm/README.md` only | Marketplace page links to GitHub instead |
| Requirements section | Both — keep in sync | Must match |

---

## Sponsor / support content

Sponsor links, Buy Me a Coffee, Liberapay, and sprite request links have been
moved to `developer_notes/SPONSOR.md`. Do **not** add them back to either
`pycharm/README.md` or `plugin.xml` without explicit user instruction.

---

## Checklist before committing

- [ ] Change applied to `pycharm/README.md`
- [ ] Equivalent change applied to `plugin.xml` `<description>` block
- [ ] HTML in `plugin.xml` is valid (tags closed, `&amp;` used for `&`)
- [ ] Both files staged in the same commit
