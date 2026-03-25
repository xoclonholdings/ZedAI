import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  X, 
  File, 
  FileText, 
  FileSpreadsheet, 
  Image,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  conversationId: string;
  onUpload: (files: any[]) => void;
  onClose: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

export default function FileUpload({ conversationId, onUpload, onClose }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/conversations/${conversationId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `${data.files.length} file(s) processed successfully`
      });
      
      // Refresh files list
      queryClient.invalidateQueries({ 
        queryKey: ["/api/conversations", conversationId, "files"] 
      });
      
      onUpload(uploadingFiles.map(uf => uf.file));
      setUploadingFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
      setUploadingFiles([]);
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const maxSize = 32 * 1024 * 1024 * 1024; // 32GB
      const allowedTypes = [
        'text/plain',
        'text/csv',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/json',
        'text/markdown'
      ];

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 32GB limit`,
          variant: "destructive"
        });
        return false;
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive"
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    // Initialize upload state
    const newUploadingFiles = validFiles.map(file => ({
      file,
      progress: 0,
      status: "uploading" as const
    }));

    setUploadingFiles(newUploadingFiles);

    // Simulate upload progress
    newUploadingFiles.forEach((uploadingFile, index) => {
      const interval = setInterval(() => {
        setUploadingFiles(prev => 
          prev.map((uf, i) => 
            i === index 
              ? { ...uf, progress: Math.min(uf.progress + 10, 90) }
              : uf
          )
        );
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setUploadingFiles(prev => 
          prev.map((uf, i) => 
            i === index 
              ? { ...uf, progress: 100, status: "processing" }
              : uf
          )
        );
      }, 1000);
    });

    // Start actual upload
    uploadMutation.mutate(validFiles);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image size={16} />;
    if (file.type.includes('csv') || file.type.includes('excel')) return <FileSpreadsheet size={16} />;
    if (file.type === 'text/plain') return <FileText size={16} />;
    return <File size={16} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-4 bg-gray-50">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Files</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? "border-primary bg-primary/5" 
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports CSV, Excel, PDF, images, text files up to 32GB
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json"
          />
        </div>

        {/* Uploading Files */}
        {uploadingFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Uploading Files</h4>
            {uploadingFiles.map((uploadingFile, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="text-gray-500">
                    {getFileIcon(uploadingFile.file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === "completed" && (
                      <CheckCircle className="text-green-500" size={16} />
                    )}
                    {uploadingFile.status === "error" && (
                      <AlertCircle className="text-red-500" size={16} />
                    )}
                    <span className="text-xs text-gray-500 capitalize">
                      {uploadingFile.status}
                    </span>
                  </div>
                </div>
                
                {uploadingFile.status === "uploading" && (
                  <div className="mt-2">
                    <Progress value={uploadingFile.progress} className="h-1" />
                  </div>
                )}
                
                {uploadingFile.error && (
                  <p className="mt-2 text-xs text-red-600">{uploadingFile.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
