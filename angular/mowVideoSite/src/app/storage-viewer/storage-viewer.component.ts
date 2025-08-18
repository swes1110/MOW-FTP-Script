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
   * Select a video for playback
   */
  selectVideo(video: VideoFile): void {
    this.selectedVideo = video;
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
}
