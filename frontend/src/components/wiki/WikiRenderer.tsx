import { useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function processWikiLinks(body: string): string {
  return body.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
    const slug = titleToSlug(title.trim());
    return `<a href="/wiki/${slug}" class="wiki-link" data-wiki-link="${slug}">${title.trim()}</a>`;
  });
}

const CALLOUT_ICONS: Record<string, string> = {
  note: '\u{1F4DD}',
  warning: '\u26A0\uFE0F',
  tip: '\u{1F4A1}',
  danger: '\u{1F525}',
  example: '\u{1F4CB}',
  todo: '\u2611\uFE0F',
  info: '\u2139\uFE0F',
  success: '\u2705',
  question: '\u2753',
  bug: '\u{1F41B}',
  quote: '\u{1F4AC}',
};

function processCallouts(body: string): string {
  return body.replace(
    /^> \[!(note|warning|tip|danger|example|todo|info|success|question|bug|quote)\][+-]?[ ]*(.*)\n((?:>[ ]?.*\n?)*)/gm,
    (_match, type: string, title: string, content: string) => {
      const cleanContent = content.replace(/^>[ ]?/gm, '').trim();
      const icon = CALLOUT_ICONS[type] || '\u2139\uFE0F';
      const displayTitle = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
      return `<div class="callout callout-${type}" data-callout="${type}">
<div class="callout-title">${icon} ${displayTitle}</div>
<div class="callout-content">\n\n${cleanContent}\n\n</div>
</div>\n`;
    },
  );
}

export default function WikiRenderer({ body }: { body: string }) {
  const navigate = useNavigate();
  const processed = processCallouts(processWikiLinks(body));
  const html = md.render(processed);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.dataset.wikiLink) {
      e.preventDefault();
      navigate(`/wiki/${target.dataset.wikiLink}`);
    }
  };

  return (
    <div
      className="wiki-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
