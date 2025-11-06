import { useEffect, useRef } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';

interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'javascript' | 'sql' | 'json';
  height?: string;
  placeholder?: string;
}

export function SchemaEditor({
  value,
  onChange,
  language,
  height = '400px',
  placeholder = 'Enter your schema here...',
}: SchemaEditorProps) {
  const editorRef = useRef<any>(null);

  function handleEditorDidMount(editor: any, monaco: Monaco) {
    editorRef.current = editor;

    // Set editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      wrappingIndent: 'indent',
    });

    // Add placeholder decoration if value is empty
    if (!value) {
      const decorations = editor.createDecorationsCollection([
        {
          range: new monaco.Range(1, 1, 1, 1),
          options: {
            after: {
              content: placeholder,
              inlineClassName: 'placeholder-decoration',
            },
            isWholeLine: true,
          },
        },
      ]);

      // Remove placeholder when typing
      editor.onDidChangeModelContent(() => {
        if (editor.getValue().length > 0) {
          decorations.clear();
        }
      });
    }
  }

  function handleEditorChange(value: string | undefined) {
    onChange(value || '');
  }

  useEffect(() => {
    // Inject custom CSS for placeholder
    const style = document.createElement('style');
    style.innerHTML = `
      .placeholder-decoration {
        opacity: 0.5;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Editor
        height={height}
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'indent',
        }}
      />
    </div>
  );
}
