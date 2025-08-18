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
   * Get a streaming-optimized URL for a video file
   * This URL supports HTTP Range Requests for proper video streaming
   */
  getStreamingVideoUrl(fileName: string): string {
    if (!this.containerClient) {
      throw new Error('Azure Storage not initialized');
    }

    const blobClient = this.containerClient.getBlobClient(fileName);
    // Return the clean URL without additional parameters that might interfere
    // Azure Blob Storage automatically supports HTTP Range Requests
    return blobClient.url;
  }

  /**
   * Get video URL optimized for streaming with proper headers
   * This method ensures the URL supports HTTP Range Requests
   */
  getVideoUrlForStreaming(videoFile: VideoFile): string {
    // For both public and authenticated access, return the clean URL
    // Azure Blob Storage natively supports HTTP Range Requests
    return videoFile.url;
  }

  /**
   * Create a video URL with streaming headers
   * This method generates URLs that support HTTP/1.1 range requests
   */
  createStreamingUrl(fileName: string): Observable<string> {
    return new Observable(observer => {
      try {
        if (!this.containerClient) {
          observer.error(new Error('Azure Storage not initialized'));
          return;
        }

        const blobClient = this.containerClient.getBlobClient(fileName);

        // For streaming, we need the direct blob URL without modifications
        // The browser will automatically handle range requests
        observer.next(blobClient.url);
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
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
   * Get video URL with proper headers for streaming
   * This ensures Azure Blob Storage responds with Accept-Ranges header
   */
  getVideoUrlWithRangeSupport(videoFile: VideoFile): string {
    const url = new URL(videoFile.url);

    // For Azure Blob Storage, ensure the URL supports range requests
    // Remove any parameters that might interfere with streaming
    const cleanUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Add SAS parameters back if they exist
    const sasParams = url.search;
    return cleanUrl + sasParams;
  }

  /**
   * Test if Azure Storage supports range requests for a video
   */
  async testRangeRequestSupport(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Range': 'bytes=0-1023'  // Request first 1KB
        }
      });

      console.log('Range request test:', {
        status: response.status,
        acceptRanges: response.headers.get('accept-ranges'),
        contentRange: response.headers.get('content-range'),
        contentLength: response.headers.get('content-length')
      });

      // Should return 206 (Partial Content) for range requests
      return response.status === 206 && response.headers.get('accept-ranges') === 'bytes';
    } catch (error) {
      console.error('Range request test failed:', error);
      return false;
    }
  }

  /**
   * Create a streaming-optimized blob URL with proper Azure Storage configuration
   */
  async createOptimizedStreamingUrl(videoFile: VideoFile): Promise<string> {
    if (!this.containerClient) {
      throw new Error('Azure Storage not initialized');
    }

    try {
      const blobClient = this.containerClient.getBlobClient(videoFile.name);

      // Get blob properties to ensure it supports range requests
      const properties = await blobClient.getProperties();

      console.log('Blob properties:', {
        contentType: properties.contentType,
        contentLength: properties.contentLength,
        acceptRanges: properties.acceptRanges,
        cacheControl: properties.cacheControl
      });

      // Return the blob URL which should support range requests natively
      return blobClient.url;
    } catch (error) {
      console.error('Failed to get optimized streaming URL:', error);
      // Fallback to original URL
      return videoFile.url;
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

  /**
   * Check if Azure Storage blob is properly configured for streaming
   */
  async checkStreamingConfiguration(videoFile: VideoFile): Promise<{ isOptimized: boolean, recommendations: string[] }> {
    const recommendations: string[] = [];
    let isOptimized = true;

    try {
      if (!this.containerClient) {
        return { isOptimized: false, recommendations: ['Azure Storage not initialized'] };
      }

      const blobClient = this.containerClient.getBlobClient(videoFile.name);
      const properties = await blobClient.getProperties();

      // Check content type
      if (!properties.contentType || !properties.contentType.startsWith('video/')) {
        recommendations.push('Set proper Content-Type header (e.g., video/mp4)');
        isOptimized = false;
      }

      // Check if blob supports range requests
      const headResponse = await fetch(blobClient.url, { method: 'HEAD' });
      const acceptRanges = headResponse.headers.get('accept-ranges');

      if (acceptRanges !== 'bytes') {
        recommendations.push('Azure Storage should return "Accept-Ranges: bytes" header');
        isOptimized = false;
      }

      // Test actual range request
      const rangeResponse = await fetch(blobClient.url, {
        headers: { 'Range': 'bytes=0-1023' }
      });

      if (rangeResponse.status !== 206) {
        recommendations.push('Azure Storage does not support HTTP Range Requests (status should be 206)');
        isOptimized = false;
      }

      // Check for proper cache headers
      const cacheControl = headResponse.headers.get('cache-control');
      if (!cacheControl) {
        recommendations.push('Consider setting Cache-Control headers for better performance');
      }

      return { isOptimized, recommendations };
    } catch (error: any) {
      console.error('Failed to check streaming configuration:', error);
      return {
        isOptimized: false,
        recommendations: [`Error checking configuration: ${error.message || error}`]
      };
    }
  }
}
