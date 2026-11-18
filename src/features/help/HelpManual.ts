export interface HelpSection {
  readonly id: string
  readonly title: string
  readonly markdown: string
}

/** Turns the bundled user guide into a chapter index for the in-app reader. */
export class HelpManual {
  readonly title: string
  readonly intro: string
  readonly sections: readonly HelpSection[]

  constructor(markdown: string) {
    const normalized = markdown.replace(/\r\n/g, '\n')
    const headings = unified()
      .use(remarkParse)
      .parse(normalized)
      .children.filter((node): node is Heading => node.type === 'heading')
    const title = headings.find((heading) => heading.depth === 1)
    const sections = headings.filter((heading) => heading.depth === 2)
    if (!title?.position?.end.offset || sections.length === 0)
      throw new Error('使用说明缺少标题或章节')
    this.title = toString(title)
    this.intro = normalized
      .slice(title.position.end.offset, sections[0]!.position?.start.offset)
      .trim()
    this.sections = sections.map((heading, index) => ({
      id: `chapter-${index + 1}`,
      title: toString(heading).trim(),
      markdown: normalized
        .slice(heading.position!.end.offset, sections[index + 1]?.position?.start.offset)
        .trim(),
    }))
  }

  getSection(id: string): HelpSection {
    return this.sections.find((section) => section.id === id) ?? this.sections[0]!
  }
}
import { toString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Heading } from 'mdast'
