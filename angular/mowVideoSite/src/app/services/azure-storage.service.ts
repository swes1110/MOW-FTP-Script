import { Injectable } from '@angular/core';
import { BlobServiceClient, ContainerClient, BlobItem } from '@azure/storage-blob';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface VideoFile {
  name: string;
  url: string;
  size: number;
  lastModified: Date;
  contentType: string;
}

@Injectable({
  providedIn: 'root'
})
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;

  constructor() {}

  /**
   * Initialize the connection to Azure Blob Storage
   * In production, use Managed Identity or SAS tokens for authentication
   * For development, you can use account key (not recommended for production)
   */
  initializeConnection(connectionString: string, containerName: string): void {
    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(containerName);
    } catch (error) {
      console.error('Failed to initialize Azure Storage connection:', error);
      throw new Error('Failed to connect to Azure Storage');
    }
  }

  /**
   * Alternative initialization using SAS URL (recommended for client-side apps)
   */
  initializeWithSasUrl(sasUrl: string): void {
    try {
      this.containerClient = new ContainerClient(sasUrl);
    } catch (error) {
      console.error('Failed to initialize Azure Storage with SAS URL:', error);
      throw new Error('Failed to connect to Azure Storage with SAS URL');
    }
  }

  /**
   * Private async method to get video files
   */
  private async getVideoFilesAsync(): Promise<VideoFile[]> {
    if (!this.containerClient) {
      throw new Error('Azure Storage not initialized');
    }

    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const videoFiles: VideoFile[] = [];

    try {
      const listBlobsResponse = this.containerClient.listBlobsFlat({
        includeMetadata: true,
        includeSnapshots: false
      });

      for await (const blob of listBlobsResponse) {
        const fileName = blob.name.toLowerCase();
        const isVideo = videoExtensions.some(ext => fileName.endsWith(ext));
        
        if (isVideo && blob.properties) {
          const blobClient = this.containerClient.getBlobClient(blob.name);
          videoFiles.push({
            name: blob.name,
            url: blobClient.url,
            size: blob.properties.contentLength || 0,
            lastModified: blob.properties.lastModified || new Date(),
            contentType: blob.properties.contentType || 'video/mp4'
          });
        }
      }
      
      return videoFiles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      console.error('Error in getVideoFilesAsync:', error);
      throw error;
    }
  }

  /**
   * List all video files in the container
   * Filters for common video file extensions
   */
  listVideoFiles(): Observable<VideoFile[]> {
    if (!this.containerClient) {
      return throwError(() => new Error('Azure Storage not initialized'));
    }

    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];

    return from(this.getVideoFilesAsync()).pipe(
      catchError((error) => {
        console.error('Error listing video files:', error);
        return throwError(() => new Error('Failed to retrieve video files from storage'));
      })
    );
  }

  /**
   * Get a direct URL for a video file
   * In production, consider using SAS tokens with limited time access
   */
  getVideoUrl(fileName: string): string {
    if (!this.containerClient) {
      throw new Error('Azure Storage not initialized');
    }

    const blobClient = this.containerClient.getBlobClient(fileName);
    return blobClient.url;
  }

  /**
   * Check if the storage service is properly initialized
   */
  isInitialized(): boolean {
    return this.containerClient !== null;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
