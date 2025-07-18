"use client";
import { useEffect, useRef } from 'react';

const SWAGGER_UI_CDN = 'https://unpkg.com/swagger-ui-dist@5.17.12/swagger-ui-bundle.js';
const SWAGGER_CSS_CDN = 'https://unpkg.com/swagger-ui-dist@5.17.12/swagger-ui.css';

export default function ApiDocsPage() {
  const uiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject Swagger UI CSS
    if (!document.getElementById('swagger-ui-css')) {
      const link = document.createElement('link');
      link.id = 'swagger-ui-css';
      link.rel = 'stylesheet';
      link.href = SWAGGER_CSS_CDN;
      document.head.appendChild(link);
      // Inject custom CSS for background fix
      const customCss = document.createElement('link');
      customCss.rel = 'stylesheet';
      customCss.href = '/swagger-custom.css';
      document.head.appendChild(customCss);
    }
    // Inject Swagger UI JS
    const script = document.createElement('script');
    script.src = SWAGGER_UI_CDN;
    script.onload = () => {
      if (window.SwaggerUIBundle) {
        window.SwaggerUIBundle({
          url: '/api/api-docs',
          domNode: uiRef.current,
        });
      } else if (uiRef.current) {
        uiRef.current.innerHTML = '<p style="color:red">Swagger UI failed to load.</p>';
      }
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#fafafa' }}>
      <div ref={uiRef} />
    </div>
  );
}
