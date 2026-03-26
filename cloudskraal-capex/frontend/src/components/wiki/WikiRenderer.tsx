import { useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

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

export default function WikiRenderer({ body }: { body: string }) {
  const navigate = useNavigate();
  const html = md.render(processWikiLinks(body));

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
