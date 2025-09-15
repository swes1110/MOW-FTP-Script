import { Component, OnInit } from '@angular/core';
import { AzureStorageService, VideoFile } from '../services/azure-storage.service';

@Component({
  selector: 'app-storage-viewer',
  templateUrl: './storage-viewer.component.html',
  styleUrls: ['./storage-viewer.component.css']
})
export class StorageViewerComponent implements OnInit {
  videoFiles: VideoFile[] = [];
  selectedVideo: VideoFile | null = null;
  loading = false;
  error: string | null = null;

  // Configuration - In production, these should come from environment variables or user input
  connectionString = ''; // Will be set by user
  containerName = '';    // Will be set by user
  sasUrl = '';          // Alternative to connection string
  storageAccountName = ''; // For public access
  publicContainerName = ''; // For public access
  accountName = '';      // For public access (alias for storageAccountName)
  isConfigured = false;

  constructor(private azureStorageService: AzureStorageService) {}

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Configure the Azure Storage connection
   */
  configureStorage(connectionString: string, containerName: string): void {
    try {
      this.azureStorageService.initializeConnection(connectionString, containerName);
      this.connectionString = connectionString;
      this.containerName = containerName;
      this.isConfigured = true;
      this.error = null;
      this.loadVideos();
    } catch (error) {
      this.error = 'Failed to configure Azure Storage connection';
      console.error('Configuration error:', error);
    }
  }

  /**
   * Configure using SAS URL (recommended for client-side apps)
   */
  configureWithSasUrl(sasUrl: string): void {
    try {
      this.azureStorageService.initializeWithSasUrl(sasUrl);
      this.sasUrl = sasUrl;
      this.isConfigured = true;
      this.error = null;
      this.loadVideos();
    } catch (error) {
      this.error = 'Failed to configure Azure Storage with SAS URL';
      console.error('SAS URL configuration error:', error);
    }
  }

  /**
   * Configure for public access storage (no authentication required)
   */
  configurePublicAccess(storageAccountName: string, containerName: string): void {
    try {
      this.azureStorageService.initializePublicAccess(storageAccountName, containerName);
      this.storageAccountName = storageAccountName;
      this.publicContainerName = containerName;
      this.isConfigured = true;
      this.error = null;
      this.loadVideos();
    } catch (error) {
      this.error = 'Failed to configure public Azure Storage access';
      console.error('Public access configuration error:', error);
    }
  }

  /**
   * Load video files from Azure Storage
   */
  loadVideos(): void {
    if (!this.azureStorageService.isInitialized()) {
      this.error = 'Azure Storage not configured';
      return;
    }

    this.loading = true;
    this.error = null;

    this.azureStorageService.listVideoFiles().subscribe({
      next: (videos) => {
        this.videoFiles = videos;
        this.loading = false;
        if (videos.length === 0) {
          this.error = 'No video files found in the container';
        }
      },
      error: (error) => {
        this.error = error.message;
        this.loading = false;
        console.error('Error loading videos:', error);
      }
    });
  }

  /**
   * Select a video for playback with streaming optimization
   */
  async selectVideo(video: VideoFile): Promise<void> {
    this.selectedVideo = video;

    const streamingUrl = this.getStreamingUrl(video);
    const optimizedUrl = await this.getOptimizedStreamingUrl(video);

    console.log(`Selected video: ${video.name}`);
    console.log(`Original URL: ${video.url}`);
    console.log(`Streaming URL: ${streamingUrl}`);
    console.log(`Optimized URL: ${optimizedUrl}`);
    console.log(`File size: ${this.formatFileSize(video.size)}`);
    console.log(`Content type: ${video.contentType}`);

    // Test range request support
    const supportsRanges = await this.azureStorageService.testRangeRequestSupport(optimizedUrl);
    console.log(`Range request support: ${supportsRanges}`);

    if (!supportsRanges) {
      console.warn('Azure Storage does not support range requests properly. Videos may download fully before playing.');
    }

    // Test if the video URL is accessible
    const isAccessible = await this.testVideoUrl(optimizedUrl);
    if (!isAccessible) {
      console.error('Video URL is not accessible. Check CORS configuration and URL validity.');
      this.error = `Video "${video.name}" cannot be accessed. Please check your Azure Storage configuration and CORS settings.`;
      return;
    }

    // Use setTimeout to ensure the video element is rendered before configuring
    setTimeout(async () => {
      const videoElement = document.querySelector('.video-player') as HTMLVideoElement;
      if (videoElement) {
        // Set the optimized URL directly
        videoElement.src = optimizedUrl;

        // Configure for streaming
        this.configureVideoForStreaming(videoElement);
        this.enableProgressiveStreaming(videoElement);

        console.log('Video element configured for streaming...');
        console.log('Video element properties:', {
          src: videoElement.src,
          preload: videoElement.preload,
          readyState: videoElement.readyState,
          networkState: videoElement.networkState
        });

        // Force reload
        videoElement.load();
      } else {
        console.error('Video element not found in DOM');
      }
    }, 100);
  }

  /**
   * Clear the selected video
   */
  clearSelection(): void {
    this.selectedVideo = null;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    return this.azureStorageService.formatFileSize(bytes);
  }

  /**
   * Get file name without extension for display
   */
  getDisplayName(fileName: string): string {
    return fileName.split('.').slice(0, -1).join('.');
  }

  /**
   * Refresh the video list
   */
  refresh(): void {
    this.loadVideos();
  }

  connectionType: 'sas' | 'connectionString' | 'public' = 'sas';
  isLoading = false;
  errorMessage = '';

  async connectToStorage() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.connectionType === 'sas') {
        this.azureStorageService.initializeWithSasUrl(this.sasUrl);
      } else if (this.connectionType === 'connectionString') {
        this.azureStorageService.initializeConnection(this.connectionString, this.containerName);
      } else if (this.connectionType === 'public') {
        this.azureStorageService.initializePublicAccess(this.accountName, this.containerName);
      }

      // Test CORS configuration
      const corsWorking = await this.azureStorageService.testCorsConfiguration();
      if (!corsWorking) {
        this.errorMessage = `
          CORS is not properly configured for your Azure Storage account.
          Please configure CORS in Azure Portal:
          1. Go to Storage Account → Resource sharing (CORS)
          2. Add rule: Origins: *, Methods: GET,HEAD,OPTIONS, Headers: *, Max age: 3600
          3. Save and wait 2-3 minutes for propagation
        `;
        this.isLoading = false;
        return;
      }

      await this.loadVideos();
      this.isConfigured = true;
    } catch (error: any) {
      console.error('Connection failed:', error);

      // Provide specific error messages for common issues
      if (error.message?.includes('CORS') || error.message?.includes('cors')) {
        this.errorMessage = `
          CORS Error: Your Azure Storage account is not configured to allow cross-origin requests.
          Please configure CORS in Azure Portal (see README for details).
        `;
      } else if (error.message?.includes('AuthenticationFailed')) {
        this.errorMessage = `
          Authentication failed. Please check:
          • SAS token is valid and not expired
          • SAS token has Read and List permissions
          • SAS token was generated for the correct container
        `;
      } else if (error.message?.includes('ContainerNotFound')) {
        this.errorMessage = `Container "${this.containerName}" not found. Please verify the container name.`;
      } else {
        this.errorMessage = `Failed to connect: ${error.message}`;
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get streaming URL for a video file with proper range request support
   */
  async getOptimizedStreamingUrl(video: VideoFile): Promise<string> {
    try {
      return await this.azureStorageService.createOptimizedStreamingUrl(video);
    } catch (error) {
      console.error('Failed to get optimized streaming URL, using fallback:', error);
      return this.azureStorageService.getVideoUrlForStreaming(video);
    }
  }

  /**
   * Get streaming URL for a video file (synchronous version for template)
   */
  getStreamingUrl(video: VideoFile): string {
    return this.azureStorageService.getVideoUrlForStreaming(video);
  }

  /**
   * Configure video element for optimal streaming
   */
  configureVideoForStreaming(videoElement: HTMLVideoElement): void {
    // Set attributes for optimal streaming
    videoElement.preload = 'metadata'; // Only load metadata initially
    // Note: Removed crossorigin attribute as it can cause CORS issues with Azure Storage

    // Add event listeners for streaming optimization and debugging
    videoElement.addEventListener('loadstart', () => {
      console.log('Video loading started:', videoElement.src);
    });

    videoElement.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded. Duration:', videoElement.duration);
    });

    videoElement.addEventListener('canplay', () => {
      console.log('Video can start playing');
    });

    videoElement.addEventListener('canplaythrough', () => {
      console.log('Video can play through without buffering');
    });

    videoElement.addEventListener('progress', () => {
      if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        const duration = videoElement.duration;
        if (duration > 0) {
          const percentBuffered = (bufferedEnd / duration) * 100;
          console.log(`Video buffered: ${percentBuffered.toFixed(1)}%`);
        }
      }
    });

    videoElement.addEventListener('error', (e) => {
      console.error('Video error:', e);
      console.error('Video error details:', {
        error: videoElement.error,
        src: videoElement.src,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState
      });
    });

    videoElement.addEventListener('stalled', () => {
      console.warn('Video playback stalled');
    });

    videoElement.addEventListener('waiting', () => {
      console.log('Video is waiting for data');
    });
  }

  /**
   * Enable progressive streaming for video element
   */
  enableProgressiveStreaming(videoElement: HTMLVideoElement): void {
    // Configure video element for optimal progressive streaming
    videoElement.preload = 'none'; // Don't preload anything initially

    // Set up progressive loading strategy
    const startProgressiveLoad = () => {
      // Only start loading when user shows intent to play
      videoElement.preload = 'metadata';
      videoElement.load();
    };

    // Add hover listener to start metadata loading
    videoElement.addEventListener('mouseenter', startProgressiveLoad, { once: true });

    // Add click listener to ensure immediate playback
    videoElement.addEventListener('click', () => {
      if (videoElement.readyState < 2) { // If metadata not loaded yet
        videoElement.preload = 'auto'; // Force loading
        videoElement.load();
      }
    });

    // Monitor buffering and adjust strategy
    videoElement.addEventListener('progress', () => {
      if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        const currentTime = videoElement.currentTime;
        const bufferedAhead = bufferedEnd - currentTime;

        // If we have less than 30 seconds buffered ahead, adjust preload strategy
        if (bufferedAhead < 30 && videoElement.preload !== 'auto') {
          console.log('Adjusting preload strategy for better streaming');
          videoElement.preload = 'auto';
        }
      }
    });

    // Add seeking optimization
    videoElement.addEventListener('seeking', () => {
      console.log('Seeking to:', videoElement.currentTime);
    });

    videoElement.addEventListener('seeked', () => {
      console.log('Seek completed');
    });
  }

  /**
   * Test if a video URL is accessible
   */
  async testVideoUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors'
      });
      console.log('Video URL test response:', {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length'),
          'accept-ranges': response.headers.get('accept-ranges')
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Video URL test failed:', error);
      return false;
    }
  }

  /**
   * Debug method to test video playback directly
   */
  async debugVideoPlayback(video: VideoFile): Promise<void> {
    console.log('=== DEBUG VIDEO PLAYBACK ===');
    console.log('Video details:', {
      name: video.name,
      size: video.size,
      contentType: video.contentType,
      originalUrl: video.url,
      streamingUrl: this.getStreamingUrl(video)
    });

    const testUrl = this.getStreamingUrl(video);

    // Test normal HEAD request
    try {
      const headResponse = await fetch(testUrl, { method: 'HEAD' });
      console.log('HEAD request response:', {
        status: headResponse.status,
        statusText: headResponse.statusText,
        contentType: headResponse.headers.get('content-type'),
        contentLength: headResponse.headers.get('content-length'),
        acceptRanges: headResponse.headers.get('accept-ranges'),
        cors: headResponse.headers.get('access-control-allow-origin')
      });
    } catch (error) {
      console.error('HEAD request failed:', error);
    }

    // Test range request specifically
    try {
      const rangeResponse = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Range': 'bytes=0-1023' }
      });
      console.log('Range request response:', {
        status: rangeResponse.status,
        statusText: rangeResponse.statusText,
        contentRange: rangeResponse.headers.get('content-range'),
        contentLength: rangeResponse.headers.get('content-length')
      });

      if (rangeResponse.status === 206) {
        console.log('✅ Range requests are supported! Streaming should work.');
      } else {
        console.log('❌ Range requests not supported. Videos will download fully.');
      }
    } catch (error) {
      console.error('Range request test failed:', error);
    }

    // Test Azure Storage properties and streaming configuration
    if (this.azureStorageService.isInitialized()) {
      try {
        const optimizedUrl = await this.azureStorageService.createOptimizedStreamingUrl(video);
        console.log('Optimized streaming URL:', optimizedUrl);

        // Check streaming configuration
        const streamingConfig = await this.azureStorageService.checkStreamingConfiguration(video);
        console.log('Streaming configuration check:', streamingConfig);

        if (!streamingConfig.isOptimized) {
          console.warn('⚠️ Streaming not optimized. Recommendations:');
          streamingConfig.recommendations.forEach(rec => console.warn(`  - ${rec}`));
        } else {
          console.log('✅ Streaming configuration is optimal');
        }
      } catch (error) {
        console.error('Failed to get optimized URL:', error);
      }
    }
  }

  /**
   * Create a test video element to verify playback
   */
  createTestVideoElement(video: VideoFile): HTMLVideoElement {
    const testVideo = document.createElement('video');
    testVideo.src = this.getStreamingUrl(video);
    testVideo.controls = true;
    testVideo.style.width = '300px';
    testVideo.style.height = '200px';
    testVideo.style.border = '2px solid red';

    testVideo.addEventListener('loadstart', () => console.log('TEST: loadstart'));
    testVideo.addEventListener('loadedmetadata', () => console.log('TEST: metadata loaded'));
    testVideo.addEventListener('canplay', () => console.log('TEST: can play'));
    testVideo.addEventListener('error', (e) => console.error('TEST: error', e));

    // Add to body temporarily for testing
    document.body.appendChild(testVideo);

    console.log('Test video element created and added to body');
    return testVideo;
  }
}
