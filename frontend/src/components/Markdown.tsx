import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders agent prose as GitHub-flavoured Markdown (headings, lists, tables,
 *  links, emphasis, code). Output is plain HTML elements so it inherits the
 *  chat's typography from `.message__content`; links open in a new tab. The
 *  custom `a` renderer strips react-markdown's `node` prop so it never leaks
 *  onto the DOM. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a(props) {
          const { node, ...rest } = props;
          void node;
          return <a {...rest} target="_blank" rel="noopener noreferrer" />;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
