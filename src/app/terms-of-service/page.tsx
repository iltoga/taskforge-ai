import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static'; // Ensure static generation

async function getTermsOfServiceMarkdown() {
  const filePath = path.join(process.cwd(), 'src/app/terms-of-service.md');
  return fs.promises.readFile(filePath, 'utf8');
}

export default async function TermsOfServicePage() {
  const markdown = await getTermsOfServiceMarkdown();
  return (
    <main className="prose mx-auto p-6">
      <h1>Terms of Service</h1>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{markdown}</ReactMarkdown>
    </main>
  );
}
