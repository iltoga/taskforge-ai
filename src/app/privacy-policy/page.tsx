import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static'; // Ensure static generation

async function getPrivacyPolicyMarkdown() {
  const filePath = path.join(process.cwd(), 'src/app/privacy-policy.md');
  return fs.promises.readFile(filePath, 'utf8');
}

export default async function PrivacyPolicyPage() {
  const markdown = await getPrivacyPolicyMarkdown();
  return (
    <main className="prose mx-auto p-6">
      <h1>Privacy Policy</h1>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{markdown}</ReactMarkdown>
    </main>
  );
}
