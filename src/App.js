import React, { useState, useEffect, useRef } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import CleaningAnimation from './CleaningAnimation';
import './App.css';

// Initialize FFmpeg
const ffmpeg = createFFmpeg({
  log: false, // Set to false to hide logs
  corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
});

// API endpoint for image analysis
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/.netlify/functions/api/api/analyze-images' 
  : '/api/analyze-images';

function App() {
  const [loaded, setLoaded] = useState(false);
  const [video, setVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [images, setImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fps, setFps] = useState(1);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const uploadRef = useRef(null);
  const [processingStep, setProcessingStep] = useState('');
  const extractedImagesRef = useRef([]);
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [quoteId, setQuoteId] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [videoStorageUrl, setVideoStorageUrl] = useState('');
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  // Load FFmpeg on component mount
  useEffect(() => {
    const load = async () => {
      try {
        await ffmpeg.load();
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        setMessage('Failed to load video processing library. Please try again later.');
        setMessageType('danger');
      }
    };
    load();
  }, []);

  // Handle file upload
  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideo(file);
        setVideoUrl(URL.createObjectURL(file));
        setImages([]);
        setMessage('');
        setAnalysis('');
      } else {
        setMessage('Please upload a valid video file.');
        setMessageType('danger');
      }
    }
  };

  // Handle drag and drop events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideo(file);
        setVideoUrl(URL.createObjectURL(file));
        setImages([]);
        setMessage('');
        setAnalysis('');
      } else {
        setMessage('Please upload a valid video file.');
        setMessageType('danger');
      }
    }
  };

  // Process video and get quote in one seamless operation
  const processVideoAndGetQuote = async () => {
    if (!video) {
      setMessage('Please upload a video first.');
      setMessageType('warning');
      return;
    }

    try {
      // Reset state
      setProcessing(true);
      setProgress(0);
      setImages([]);
      extractedImagesRef.current = [];
      setAnalysis('');
      setMessage('');
      setProcessingStep('Analyzing video...');

      // Step 1: Extract frames from video
      await extractFramesFromVideo();
      
      if (extractedImagesRef.current.length === 0) {
        throw new Error('No frames could be extracted from the video');
      }
      
      // Step 2: Send images to AI for analysis
      setProcessingStep('Generating cleaning quote...');
      await analyzeImagesWithAI();
      
      // Generate a unique quote ID but don't save to database yet
      const timestamp = new Date().getTime();
      const randomStr = Math.random().toString(36).substring(2, 8);
      setQuoteId(`QQ-${timestamp.toString().slice(-6)}-${randomStr}`);
      
    } catch (error) {
      console.error('Error processing video:', error);
      setMessage(`Error processing your video: ${error.message}. Please try again.`);
      setMessageType('danger');
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  // Extract frames from video
  const extractFramesFromVideo = async () => {
    try {
      // Write the video file to FFmpeg's file system
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(video));

      // Extract frames from the video
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-vf', `fps=${fps}`,
        '-vsync', '0',
        '-frame_pts', '1',
        'frame_%05d.png'
      );

      // Read the result files and create image objects
      const frameFiles = ffmpeg.FS('readdir', '.').filter(file => file.startsWith('frame_'));
      const totalFrames = frameFiles.length;
      
      if (totalFrames === 0) {
        throw new Error('No frames could be extracted from the video');
      }
      
      const newImages = [];
      for (let i = 0; i < totalFrames; i++) {
        const fileName = frameFiles[i];
        const data = ffmpeg.FS('readFile', fileName);
        const blob = new Blob([data.buffer], { type: 'image/png' });
        
        newImages.push({
          id: i + 1,
          name: `frame_${String(i + 1).padStart(5, '0')}.png`,
          blob
        });
        
        // Update progress
        setProgress(Math.round((25 + ((i + 1) / totalFrames) * 50)));
      }
      
      setImages(newImages);
      extractedImagesRef.current = newImages;
    } catch (error) {
      console.error('Error extracting frames:', error);
      throw new Error('Failed to extract frames from video');
    }
  };

  // Send images to AI for analysis
  const analyzeImagesWithAI = async () => {
    try {
      const framesToAnalyze = extractedImagesRef.current;
      
      if (!framesToAnalyze || framesToAnalyze.length === 0) {
        throw new Error('No images to analyze');
      }
      
      // Create a FormData object to send the images
      const formData = new FormData();
      
      // Add each image to the form data
      // Limit to a reasonable number of images to avoid overwhelming the API
      const imagesToSend = framesToAnalyze.length > 20 ? 
        framesToAnalyze.filter((_, index) => index % Math.ceil(framesToAnalyze.length / 20) === 0) : 
        framesToAnalyze;
      
      imagesToSend.forEach(image => {
        formData.append('images', image.blob, image.name);
      });

      // Send the request to the server
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if the error is related to the API key
        if (errorData.missingApiKey) {
          throw new Error('OpenAI API key is missing or invalid. Please contact the administrator to fix this issue.');
        }
        
        throw new Error(`Server responded with ${response.status}: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Clean up the formatting of the analysis text
      let cleanedAnalysis = data.analysis;
      // Remove markdown formatting like ** (bold) and * (italic)
      cleanedAnalysis = cleanedAnalysis.replace(/\*\*/g, '').replace(/\*/g, '');
      // Remove any other unwanted formatting
      cleanedAnalysis = cleanedAnalysis.replace(/#{1,6}\s/g, ''); // Remove headings
      cleanedAnalysis = cleanedAnalysis.replace(/\n\s*-\s/g, '\n• '); // Convert dashes to bullets
      
      setAnalysis(cleanedAnalysis);
      setProgress(100);
    } catch (error) {
      console.error('Error analyzing images:', error);
      throw new Error(`Failed to analyze video: ${error.message}`);
    }
  };

  // Reset the application state
  const resetApp = () => {
    setVideo(null);
    setVideoUrl('');
    setImages([]);
    extractedImagesRef.current = [];
    setProgress(0);
    setMessage('');
    setAnalysis('');
    setShowUserForm(false);
    setQuoteId('');
    setShowThankYouModal(false);
    
    // Reset user info form
    setUserInfo({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    });
    
    // Free memory by revoking object URLs
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  };

  // Handle user info form changes
  const handleUserInfoChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save quote and user information
  const saveQuoteInfo = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!userInfo.name || !userInfo.email || !userInfo.phone) {
      setMessage('Please fill in your name, email, and phone number.');
      setMessageType('warning');
      return;
    }
    
    try {
      setMessage('Saving your quote...');
      setMessageType('info');
      
      // First, save the quote and user info to the database
      const quoteResponse = await fetch('/api/save-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId,
          quoteText: analysis,
          userInfo
        }),
      });
      
      if (!quoteResponse.ok) {
        throw new Error('Failed to save quote');
      }
      
      // Then, upload the video to Cloudinary
      if (video) {
        const formData = new FormData();
        formData.append('video', video);
        formData.append('quoteId', quoteId);
        
        const videoResponse = await fetch('/api/upload-video', {
          method: 'POST',
          body: formData,
        });
        
        if (!videoResponse.ok) {
          console.warn('Video upload failed, but quote was saved');
        } else {
          const videoData = await videoResponse.json();
          setVideoStorageUrl(videoData.videoUrl);
        }
      }
      
      // Hide the form and show the thank you modal
      setShowUserForm(false);
      setMessage('');
      setShowThankYouModal(true);
      
      // Automatically close the thank you modal after 5 seconds
      setTimeout(() => {
        resetApp();
      }, 5000);
      
    } catch (error) {
      console.error('Error saving quote:', error);
      setMessage(`Error saving your quote: ${error.message}`);
      setMessageType('danger');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="container">
          <div className="row align-items-center">
            <div className="col">
              <h1 className="brand">QuickQuote</h1>
              <p className="tagline">Instant cleaning quotes from your videos</p>
            </div>
            <div className="col-auto d-none d-md-block">
              <div className="header-contact">
                <a href="tel:+442012345678" className="text-white me-3">
                  <i className="bi bi-telephone-fill me-1"></i> +44 (0)20 1234 5678
                </a>
                <a href="mailto:info@quickquote.com" className="text-white">
                  <i className="bi bi-envelope-fill me-1"></i> info@quickquote.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mt-4">
        <div className="row">
          <div className="col-lg-8 offset-lg-2">
            <div className="card main-card">
              <div className="card-body">
                <h2 className="card-title text-center mb-4">Get Your Cleaning Quote</h2>
                
                {!loaded ? (
                  <div className="text-center p-5">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3">Initializing video analyzer...</p>
                  </div>
                ) : (
                  <>
                    {!video && (
                      <>
                        <div className="how-it-works mb-4">
                          <h3 className="section-title">How It Works</h3>
                          <div className="row text-center g-3">
                            <div className="col-md-4">
                              <div className="step-card">
                                <div className="step-number">1</div>
                                <div className="step-icon">
                                  <i className="bi bi-camera-video-fill"></i>
                                </div>
                                <h4>Upload Video</h4>
                                <p>Upload a video of the space you need cleaned</p>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="step-card">
                                <div className="step-number">2</div>
                                <div className="step-icon">
                                  <i className="bi bi-magic"></i>
                                </div>
                                <h4>AI Analysis</h4>
                                <p>Our AI analyzes your space in detail</p>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="step-card">
                                <div className="step-number">3</div>
                                <div className="step-icon">
                                  <i className="bi bi-receipt"></i>
                                </div>
                                <h4>Get Quote</h4>
                                <p>Receive a detailed cleaning quote instantly</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div 
                          className={`upload-container ${isDragging ? 'active' : ''}`}
                          onClick={() => uploadRef.current.click()}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <input 
                            type="file" 
                            ref={uploadRef}
                            onChange={handleUpload} 
                            accept="video/*" 
                            style={{ display: 'none' }} 
                          />
                          <div className="upload-icon">
                            <i className="bi bi-cloud-arrow-up"></i>
                          </div>
                          <h3>Upload a Video of Your Space</h3>
                          <p>Drag & drop here or click to browse</p>
                          <p className="upload-info">
                            We'll analyze your video and provide an instant cleaning quote
                          </p>
                          <div className="upload-formats mt-3">
                            <small>Supported formats: MP4, MOV, AVI, WEBM (Max 100MB)</small>
                          </div>
                        </div>
                      </>
                    )}
                    {videoUrl && !processing && !analysis && (
                      <div className="video-preview-container">
                        <div className="row g-4">
                          <div className="col-lg-8">
                            <div className="video-card">
                              <h3 className="video-title">Video Preview</h3>
                              <div className="video-wrapper">
                                <video 
                                  className="video-preview" 
                                  src={videoUrl} 
                                  controls
                                />
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-4">
                            <div className="video-info-panel">
                              <div className="info-panel-content">
                                <div className="info-icon">
                                  <i className="bi bi-check-circle-fill"></i>
                                </div>
                                <h4>Ready to Analyze</h4>
                                <p>Click the button below to analyze your video and get an instant cleaning quote.</p>
                                <div className="action-buttons">
                                  <button 
                                    className="btn btn-primary btn-lg w-100" 
                                    onClick={processVideoAndGetQuote} 
                                    disabled={processing}
                                  >
                                    <i className="bi bi-magic me-2"></i>
                                    Get Cleaning Quote
                                  </button>
                                  <button 
                                    className="btn btn-outline-secondary w-100 mt-3" 
                                    onClick={resetApp}
                                  >
                                    <i className="bi bi-x-circle me-2"></i>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {processing && (
                      <div className="processing-container text-center p-5">
                        <div className="progress-container mb-4">
                          <div className="progress" style={{ height: '25px' }}>
                            <div 
                              className="progress-bar progress-bar-striped progress-bar-animated" 
                              role="progressbar" 
                              style={{ width: `${progress}%` }} 
                              aria-valuenow={progress} 
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            >
                              {progress}%
                            </div>
                          </div>
                          <p className="mt-2">{processingStep}</p>
                        </div>
                        <div className="processing-animation">
                          <CleaningAnimation />
                        </div>
                        <h3 className="mt-4">Analyzing Your Video</h3>
                        <p className="text-muted">
                          Our AI is examining your space to provide an accurate cleaning quote.
                          This may take a moment depending on the video length.
                        </p>
                      </div>
                    )}

                    {message && (
                      <div className={`alert alert-${messageType} mt-3`} role="alert">
                        {message}
                      </div>
                    )}

                    {analysis && (
                      <div className="analysis-result">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h3 className="mb-0">Your Cleaning Quote</h3>
                          <button 
                            className="btn btn-outline-secondary" 
                            onClick={resetApp}
                          >
                            Start Over
                          </button>
                        </div>
                        <div className="card quote-card">
                          <div className="card-header">
                            <div className="d-flex justify-content-between align-items-center">
                              <h4 className="mb-0">Quote #{quoteId}</h4>
                              <span className="badge bg-success">Ready to Book</span>
                            </div>
                          </div>
                          <div className="card-body quote-content">
                            <pre className="analysis-text">{analysis}</pre>
                          </div>
                          <div className="card-footer">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <small className="text-muted">Generated on {new Date().toLocaleDateString()}</small>
                              </div>
                              <button 
                                className="btn btn-primary" 
                                onClick={() => setShowUserForm(true)}
                              >
                                <i className="bi bi-calendar-check me-2"></i>
                                Book This Cleaning
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <p className="text-muted">
                            Need to discuss this quote? Contact us at:
                          </p>
                          <div className="contact-info">
                            <p><strong>Email:</strong> bookings@quickquote.com</p>
                            <p><strong>Phone:</strong> +44 (0)20 1234 5678</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {showUserForm && (
                      <div className="user-info-form">
                        <h3 className="mb-3">Book Your Cleaning Service</h3>
                        <form onSubmit={saveQuoteInfo}>
                          <div className="mb-3">
                            <label className="form-label" htmlFor="name">Name:</label>
                            <input 
                              type="text" 
                              id="name" 
                              name="name" 
                              className="form-control" 
                              value={userInfo.name} 
                              onChange={handleUserInfoChange}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label" htmlFor="email">Email:</label>
                            <input 
                              type="email" 
                              id="email" 
                              name="email" 
                              className="form-control" 
                              value={userInfo.email} 
                              onChange={handleUserInfoChange}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label" htmlFor="phone">Phone:</label>
                            <input 
                              type="tel" 
                              id="phone" 
                              name="phone" 
                              className="form-control" 
                              value={userInfo.phone} 
                              onChange={handleUserInfoChange}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label" htmlFor="address">Address:</label>
                            <textarea 
                              id="address" 
                              name="address" 
                              className="form-control" 
                              value={userInfo.address} 
                              onChange={handleUserInfoChange}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label" htmlFor="notes">Additional Notes:</label>
                            <textarea 
                              id="notes" 
                              name="notes" 
                              className="form-control" 
                              value={userInfo.notes} 
                              onChange={handleUserInfoChange}
                            />
                          </div>
                          <div className="d-flex justify-content-between">
                            <button 
                              className="btn btn-primary" 
                              type="submit"
                            >
                              Save Quote
                            </button>
                            <button 
                              className="btn btn-outline-secondary" 
                              onClick={() => setShowUserForm(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                    {showThankYouModal && (
                      <div className="thank-you-modal">
                        <div className="thank-you-content">
                          <div className="thank-you-icon">
                            <i className="bi bi-check-circle-fill"></i>
                          </div>
                          <h3>Thank You!</h3>
                          <p>Your cleaning quote has been saved successfully.</p>
                          <p>The cleaning company will be in touch shortly to plan your cleaning service.</p>
                          <p className="quote-reference">Quote Reference: {quoteId}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer mt-5">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h3>QuickQuote</h3>
              <p>Instant AI-powered cleaning quotes from your videos</p>
            </div>
            <div className="col-md-6 text-md-end">
              <p>&copy; {new Date().getFullYear()} QuickQuote Ltd. All rights reserved.</p>
              <p>
                <a href="/admin" className="text-white text-decoration-none">
                  <i className="bi bi-shield-lock me-1"></i>
                  Admin Portal
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
