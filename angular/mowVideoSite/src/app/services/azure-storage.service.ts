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
  private isPublicAccess = false;
  private publicBaseUrl = '';

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
      this.isPublicAccess = false;
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
      this.isPublicAccess = false;
    } catch (error) {
      console.error('Failed to initialize Azure Storage with SAS URL:', error);
      throw new Error('Failed to connect to Azure Storage with SAS URL');
    }
  }

  /**
   * Initialize connection for public blob storage (no authentication required)
   * Use this when your container has public read access enabled
   */
  initializePublicAccess(storageAccountName: string, containerName: string): void {
    try {
      const publicUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}`;
      // For public access, we create a container client without authentication
      this.containerClient = new ContainerClient(publicUrl);
      this.publicBaseUrl = publicUrl;
      this.isPublicAccess = true;
    } catch (error) {
      console.error('Failed to initialize public Azure Storage connection:', error);
      throw new Error('Failed to connect to public Azure Storage');
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
   * Test CORS configuration by making a simple request
   */
  async testCorsConfiguration(): Promise<boolean> {
    if (!this.containerClient && !this.isPublicAccess) {
      throw new Error('No storage connection configured');
    }

    try {
      if (this.isPublicAccess) {
        // Test public access with a simple fetch
        const response = await fetch(`${this.publicBaseUrl}?restype=container&comp=list&maxresults=1`, {
          method: 'GET',
          mode: 'cors'
        });
        return response.ok;
      } else {
        // Test with Azure SDK
        const iterator = this.containerClient!.listBlobsFlat();
        const result = await iterator.next();
        return !result.done || result.value !== undefined;
      }
    } catch (error: any) {
      console.error('CORS test failed:', error);
      if (error.message?.includes('CORS') || error.message?.includes('cors')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get video URL with CORS-friendly parameters
   */
  getVideoUrlWithCorsHeaders(videoFile: VideoFile): string {
    if (this.isPublicAccess) {
      // For public access, add cache-busting parameter
      const url = new URL(videoFile.url);
      url.searchParams.set('t', Date.now().toString());
      return url.toString();
    }
    return videoFile.url;
  }

  /**
   * Alternative method to fetch video files using direct HTTP requests
   * This can sometimes work better with CORS than the Azure SDK
   */
  private async getVideoFilesViaHttp(): Promise<VideoFile[]> {
    if (!this.isPublicAccess) {
      throw new Error('HTTP method only available for public access');
    }

    try {
      const response = await fetch(`${this.publicBaseUrl}?restype=container&comp=list`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/xml'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const blobs = xmlDoc.getElementsByTagName('Blob');
      const videoFiles: VideoFile[] = [];

      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        const name = blob.getElementsByTagName('Name')[0]?.textContent || '';
        const size = parseInt(blob.getElementsByTagName('Content-Length')[0]?.textContent || '0');
        const lastModified = new Date(blob.getElementsByTagName('Last-Modified')[0]?.textContent || '');
        const contentType = blob.getElementsByTagName('Content-Type')[0]?.textContent || '';

        if (this.isVideoFile(name)) {
          videoFiles.push({
            name,
            url: `${this.publicBaseUrl}/${name}`,
            size,
            lastModified,
            contentType
          });
        }
      }

      return videoFiles;
    } catch (error: any) {
      console.error('HTTP fetch failed:', error);
      throw new Error(`Failed to fetch videos via HTTP: ${error.message}`);
    }
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

  /**
   * Check if a file is a video based on its name
   */
  private isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    return videoExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }
}
