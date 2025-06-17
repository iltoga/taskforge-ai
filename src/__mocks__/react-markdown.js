// Mock react-markdown for Jest tests
import React from 'react';

const ReactMarkdown = ({ children, ...props }) => {
  return React.createElement('div', { ...props, 'data-testid': 'mock-markdown' }, children);
};

export default ReactMarkdown;
