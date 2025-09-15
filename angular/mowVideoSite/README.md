# Azure Blob Storage Video Player

A modern, responsive Angular application for browsing and playing video files stored in Azure Blob Storage. This application provides a secure way to connect to Azure Storage and stream videos with a beautiful, user-friendly interface.

## ✨ Features

- 🔐 **Secure Authentication**: Connect using Azure SAS URLs or connection strings
- 🎥 **Video Streaming**: True streaming support with HTTP Range Requests (no full download required)
- 📱 **Responsive Design**: Modern UI that works on desktop and mobile devices
- 🖼️ **Video Thumbnails**: Generate video previews for better browsing experience
- 🎨 **Modern Interface**: Beautiful gradient design with glassmorphism effects
- ⚡ **Performance**: Efficient async loading, streaming optimization, and error handling
- 🌐 **CORS Support**: Built-in CORS handling and testing for Azure Storage
- 🎛️ **Streaming Controls**: Optimized video player with buffering indicators and progress tracking

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Angular CLI (`npm install -g @angular/cli`)
- Azure Storage Account with video files

### Installation

1. Clone or download this project
2. Navigate to the project directory:
   ```bash
   cd angular/mowVideoSite
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   ng serve
   ```
5. Open your browser to `http://localhost:4200`

## 🔧 Configuration

The application supports two authentication methods:

### Option 1: SAS URL (Recommended)
1. Go to your Azure Storage Account in the Azure Portal
2. Navigate to **Containers** and select your video container
3. Click **Generate SAS** and configure:
   - **Permissions**: Read and List
   - **Start and expiry date/time**: Set appropriate timeframe
   - **Allowed services**: Blob
   - **Allowed resource types**: Container and Object
4. Copy the generated **Blob SAS URL**
5. In the application, paste the SAS URL in the **SAS URL** field

### Option 2: Connection String
1. Go to your Azure Storage Account in the Azure Portal
2. Navigate to **Access keys** under **Security + networking**
3. Copy the **Connection string** for key1 or key2
4. In the application, paste the connection string in the **Connection String** field
5. Enter your **Container Name** (e.g., "videos")

## 🎬 Usage

1. **Configure Connection**: Choose either SAS URL or Connection String method
2. **Connect**: Click the "Connect to Storage" button
3. **Browse Videos**: View all available videos in a responsive grid layout
4. **Play Videos**: Click on any video thumbnail to start playback
5. **Video Controls**: Use the built-in HTML5 video player controls

### 🎥 Video Streaming Features

- **True Streaming**: Videos start playing immediately without downloading the entire file
- **HTTP Range Requests**: Supports seeking to any position in the video instantly
- **Buffering Indicators**: Visual feedback on video loading progress
- **Adaptive Loading**: Thumbnails load on-demand for better performance
- **CORS Optimized**: Automatic CORS configuration testing and optimization

### 📱 Performance Optimizations

- **Lazy Thumbnail Loading**: Video thumbnails only load when needed
- **Metadata Preloading**: Only essential video metadata is preloaded
- **Streaming URLs**: Optimized URLs for maximum streaming performance
- **Range Request Support**: Full support for HTTP/1.1 range requests

## 📁 Supported Video Formats

The application supports all video formats that are compatible with HTML5 video players:
- MP4 (recommended)
- WebM
- OGV
- MOV
- AVI

## 🛡️ Security Best Practices

- **Use SAS URLs** instead of connection strings when possible
- **Set appropriate expiration times** for SAS tokens
- **Limit permissions** to Read and List only
- **Consider CORS settings** in your Azure Storage Account
- **Use HTTPS** in production environments

## 🏗️ Project Structure

```
src/
├── app/
│   ├── services/
│   │   └── azure-storage.service.ts    # Azure Storage integration
│   ├── storage-viewer/
│   │   ├── storage-viewer.component.ts  # Main component logic
│   │   ├── storage-viewer.component.html # UI template
│   │   └── storage-viewer.component.css  # Modern styling
│   ├── app.component.html              # App shell
│   └── app.module.ts                   # Module configuration
├── index.html                          # Main HTML with FontAwesome
└── styles.css                          # Global styles
```

## 🔨 Development

### Development server
Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Build
Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Code scaffolding
Run `ng generate component component-name` to generate a new component.

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Configure CORS settings in your Azure Storage Account
2. **SAS Token Expired**: Generate a new SAS URL with extended expiration
3. **Videos Not Loading**: Check container permissions and video file formats
4. **Connection Failed**: Verify your connection string or SAS URL is correct

### Error Messages

- **"Failed to connect to Azure Storage"**: Check your credentials and network connection
- **"No videos found"**: Ensure your container has video files and proper permissions
- **"Video failed to load"**: Check video file format and Azure Storage accessibility

## 📦 Dependencies

- **@angular/core**: Angular framework
- **@azure/storage-blob**: Azure Blob Storage SDK
- **FontAwesome**: Icons and UI elements

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
