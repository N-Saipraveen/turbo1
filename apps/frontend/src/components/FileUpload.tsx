import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUpload: (data: any) => void;
  className?: string;
}

export function FileUpload({ onFileUpload, className }: FileUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);

      try {
        const text = await file.text();
        const jsonData = JSON.parse(text);

        setUploadStatus('success');
        setTimeout(() => {
          onFileUpload(jsonData);
        }, 500);
      } catch (error) {
        setUploadStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Invalid JSON file');
        setTimeout(() => {
          setUploadStatus('idle');
          setErrorMessage('');
        }, 3000);
      }
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    multiple: false,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('w-full', className)}
    >
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500',
          'bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30',
          'hover:shadow-2xl hover:scale-[1.02]',
          isDragActive
            ? 'border-purple-500 bg-purple-50/50 shadow-lg shadow-purple-200'
            : uploadStatus === 'success'
            ? 'border-green-400 bg-green-50/50 shadow-lg shadow-green-200'
            : uploadStatus === 'error'
            ? 'border-red-400 bg-red-50/50 shadow-lg shadow-red-200'
            : 'border-gray-300/60 hover:border-purple-400'
        )}
      >
        <input {...getInputProps()} />

        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-400/10 via-pink-400/10 to-blue-400/10 opacity-0 transition-opacity duration-500 hover:opacity-100" />

        <div className="relative px-8 py-16">
          <AnimatePresence mode="wait">
            {uploadStatus === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center gap-6 text-center"
              >
                <motion.div
                  animate={
                    isDragActive
                      ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.5 }}
                  className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-6 shadow-lg shadow-purple-300/50"
                >
                  <Upload className="h-12 w-12 text-white" />
                </motion.div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {isDragActive ? 'Drop your JSON file here' : 'Upload JSON Data'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Drag and drop your JSON file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports .json files only • Max 10MB
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-3 font-semibold text-white shadow-lg shadow-purple-300/50 transition-all hover:shadow-xl hover:shadow-purple-400/50"
                >
                  Choose File
                </motion.button>
              </motion.div>
            )}

            {uploadStatus === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center gap-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="rounded-full bg-green-500 p-6 shadow-lg shadow-green-300/50"
                >
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </motion.div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-green-700">JSON Uploaded!</h3>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <FileJson className="h-4 w-4" />
                    <span>{fileName}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {uploadStatus === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center gap-4 text-center"
              >
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="rounded-full bg-red-500 p-6 shadow-lg shadow-red-300/50"
                >
                  <AlertCircle className="h-12 w-12 text-white" />
                </motion.div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-red-700">Upload Failed</h3>
                  <p className="text-sm text-red-600">{errorMessage}</p>
                  <p className="text-xs text-gray-500">Click to try again</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pulse effect on drag active */}
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 -z-10 rounded-3xl bg-purple-400"
          />
        )}
      </div>
    </motion.div>
  );
}
