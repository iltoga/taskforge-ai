import React from 'react';

// Mock component for react-markdown in tests
const ReactMarkdown: React.FC<{ children: string; rehypePlugins?: unknown[] }> = ({ children }) => {
  return <div data-testid="react-markdown">{children}</div>;
};

export default ReactMarkdown;
