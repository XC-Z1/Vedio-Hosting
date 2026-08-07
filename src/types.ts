export interface VideoMeta {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  downloadUrl?: string;
  viewCount?: number;
  duration?: number;
  tags?: string[];
  dataUrl?: string;
}
