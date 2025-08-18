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
}
