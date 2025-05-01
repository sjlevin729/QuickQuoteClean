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
const API_URL = '/api/analyze-images';

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
  const [cleaningContext, setCleaningContext] = useState('');
  const [duration, setDuration] = useState(0);
  const [cleaningServices, setCleaningServices] = useState({
    generalCleaning: true,
    deepCleaning: false,
    vacuuming: true,
    mopping: true,
    dusting: true,
    kitchenCleaning: true,
    bathroomCleaning: true,
    windowCleaning: false,
    applianceCleaning: false,
    decluttering: false,
    laundry: false,
    dishwashing: false,
    carpetCleaning: false,
    upholsteryCleaning: false,
    wallCleaning: false,
    ceilingCleaning: false
  });

  // Handle checkbox change
  const handleServiceChange = (e) => {
    const { name, checked } = e.target;
    setCleaningServices(prev => ({
      ...prev,
      [name]: checked
    }));
  };

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

  // Extract frames from the video
  const extractFrames = async () => {
    try {
      setProcessingStep('Extracting frames from video...');
      
      // Write the video file to FFmpeg's virtual file system
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(video));
      
      // Calculate how many frames to extract based on video duration
      const frameCount = 10; // Limit to 10 frames to avoid API payload size issues
      
      // Run FFmpeg command to extract frames
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-vf', `fps=1/${Math.ceil(duration / frameCount)}`,
        '-vsync', 'vfr',
        '-q:v', '2',
        '-f', 'image2',
        'frame_%03d.jpg'
      );
      
      // Read the extracted frames
      const frames = [];
      let i = 1;
      
      while (true) {
        try {
          const filename = `frame_${String(i).padStart(3, '0')}.jpg`;
          const data = ffmpeg.FS('readFile', filename);
          const blob = new Blob([data.buffer], { type: 'image/jpeg' });
          frames.push({
            name: filename,
            blob: blob,
            url: URL.createObjectURL(blob)
          });
          i++;
        } catch (error) {
          // No more frames
          break;
        }
      }
      
      console.log(`Extracted ${frames.length} frames from video`);
      extractedImagesRef.current = frames;
      setImages(frames.map(f => f.url));
      
      return frames;
    } catch (error) {
      console.error('Error extracting frames:', error);
      setMessage(`Failed to extract frames: ${error.message}`);
      setMessageType('danger');
      setProcessing(false);
      throw error;
    }
  };

  // Modified function to include cleaning context in the API request
  const analyzeImages = async (imageFiles) => {
    try {
      setProcessingStep('Analyzing images with AI...');
      
      const formData = new FormData();
      
      // Limit the number of images to avoid payload size issues
      const maxImages = 10;
      const limitedImages = imageFiles.length > maxImages 
        ? imageFiles.filter((_, index) => index % Math.ceil(imageFiles.length / maxImages) === 0).slice(0, maxImages)
        : imageFiles;
      
      console.log(`Sending ${limitedImages.length} images for analysis (from ${imageFiles.length} total)`);
      
      // Add each image to the form data
      limitedImages.forEach((image, index) => {
        formData.append('images', image.blob, image.name);
      });
      
      // Add cleaning context to the request if provided
      if (cleaningContext.trim()) {
        formData.append('context', cleaningContext);
      }
      
      // Add selected cleaning services to the request
      formData.append('services', JSON.stringify(cleaningServices));
      
      // Log the request details
      console.log('Sending API request to:', API_URL);
      console.log('With context:', cleaningContext ? 'Yes' : 'No');
      console.log('Selected services:', Object.entries(cleaningServices)
        .filter(([_, selected]) => selected)
        .map(([service]) => service)
        .join(', '));
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Format the analysis text for better display
      let formattedAnalysis = data.analysis;
      
      // Remove any remaining markdown formatting
      formattedAnalysis = formattedAnalysis.replace(/#{1,6}\s/g, ''); // Remove headings
      formattedAnalysis = formattedAnalysis.replace(/\*\*/g, ''); // Remove bold
      formattedAnalysis = formattedAnalysis.replace(/\*/g, ''); // Remove italic
      formattedAnalysis = formattedAnalysis.replace(/`/g, ''); // Remove code formatting
      
      // Convert markdown-style lists to plain text with proper spacing
      formattedAnalysis = formattedAnalysis.replace(/^\s*[-*]\s/gm, '• '); // Convert list markers
      
      setAnalysis(formattedAnalysis);
      setQuoteId(data.quoteId || `QQ${Math.floor(Math.random() * 10000)}`);
      setProcessing(false);
      setProgress(100);
      setProcessingStep('Quote generated successfully!');
      
    } catch (error) {
      console.error('Error analyzing images:', error);
      setMessage(`Failed to analyze images: ${error.message}`);
      setMessageType('danger');
      setProcessing(false);
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
      await extractFrames();
      
      if (extractedImagesRef.current.length === 0) {
        throw new Error('No frames could be extracted from the video');
      }
      
      // Step 2: Send images to AI for analysis
      setProcessingStep('Generating cleaning quote...');
      await analyzeImages(extractedImagesRef.current);
      
    } catch (error) {
      console.error('Error processing video:', error);
      setMessage(`Error processing your video: ${error.message}. Please try again.`);
      setMessageType('danger');
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  // Handle video selection
  const handleVideoSelect = (file) => {
    if (file.type.startsWith('video/')) {
      setVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      
      // Get video duration
      const videoElement = document.createElement('video');
      videoElement.src = url;
      videoElement.onloadedmetadata = () => {
        setDuration(videoElement.duration);
        console.log('Video duration:', videoElement.duration);
      };
      
      setImages([]);
      setMessage('');
      setAnalysis('');
    } else {
      setMessage('Please upload a valid video file.');
      setMessageType('danger');
    }
  };

  // Handle file upload
  const handleUpload = (event) => {
    const file = event.target.files[0];
    handleVideoSelect(file);
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
    handleVideoSelect(file);
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
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand">QuickQuoteClean</div>
          <div className="contact-info">
            <div className="contact-item">
              <i className="bi bi-telephone"></i>
              +447539412914
            </div>
            <div className="contact-item">
              <i className="bi bi-envelope"></i>
              quickquoteclean@gmail.com
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Instant Cleaning Quotes with AI</h1>
          <p className="hero-subtitle">Upload a video of your space and get a detailed cleaning quote in minutes</p>
        </div>
      </section>

      {/* Main Content */}
      <main className="main-content">
        <h2 className="section-title">Get Your Cleaning Quote</h2>
        <p className="section-subtitle">Simply upload a video of the space you need cleaned, and our AI will analyze it to provide a detailed quote</p>

        {/* How It Works Section */}
        <section className="how-it-works">
          <h3 className="section-title">How It Works</h3>
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <i className="bi bi-camera-video"></i>
              </div>
              <h4 className="step-title">Upload Video</h4>
              <p className="step-description">Upload a video of the space you need cleaned</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <i className="bi bi-chat-text"></i>
              </div>
              <h4 className="step-title">Add Context</h4>
              <p className="step-description">Tell us about your specific cleaning needs</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <i className="bi bi-robot"></i>
              </div>
              <h4 className="step-title">AI Analysis</h4>
              <p className="step-description">Our AI analyzes your space in detail</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-icon">
                <i className="bi bi-receipt"></i>
              </div>
              <h4 className="step-title">Get Quote</h4>
              <p className="step-description">Receive a detailed cleaning quote instantly</p>
            </div>
          </div>
        </section>

        {/* Message Display */}
        {message && (
          <div className={`message message-${messageType}`}>
            {message}
          </div>
        )}

        {/* Upload Section */}
        {!processing && !analysis && !videoUrl && (
          <section className="upload-section">
            <div
              className={`upload-container ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                  handleUpload(e);
                } else {
                  setMessage('Please drop a valid video file.');
                  setMessageType('warning');
                }
              }}
              onClick={() => uploadRef.current.click()}
            >
              <div className="upload-icon">
                <i className="bi bi-cloud-arrow-up"></i>
              </div>
              <h3 className="upload-text">Upload a Video</h3>
              <p className="upload-subtext">Click or drag and drop your video here</p>
              <p className="upload-subtext">Supported formats: MP4, MOV, AVI (Max 100MB)</p>
              <input
                type="file"
                ref={uploadRef}
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    handleUpload(e);
                  }
                }}
                accept="video/*"
                style={{ display: 'none' }}
              />
            </div>
          </section>
        )}

        {/* Video Preview Section */}
        {videoUrl && !processing && !analysis && (
          <section className="video-preview-container">
            <h3 className="section-title">Video Preview</h3>
            <div className="video-preview-content">
              <div className="video-preview-player">
                <video className="video-player" src={videoUrl} controls />
              </div>
              <div className="video-preview-actions">
                <div className="video-actions-card">
                  <h4 className="video-title">Ready for Analysis</h4>
                  
                  <div className="form-group">
                    <label className="context-label" htmlFor="cleaning-context">
                      Cleaning Requirements
                    </label>
                    <textarea
                      id="cleaning-context"
                      className="context-textarea"
                      placeholder="Tell us about your specific cleaning needs, preferences, or any areas that need special attention..."
                      value={cleaningContext}
                      onChange={(e) => setCleaningContext(e.target.value)}
                    ></textarea>
                    <p className="context-helper">This information will help our AI provide a more accurate quote.</p>
                  </div>
                  
                  <div className="form-group">
                    <label className="context-label" htmlFor="cleaning-services">
                      Select Cleaning Services
                    </label>
                    <div className="checkbox-group">
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="general-cleaning"
                          name="generalCleaning"
                          checked={cleaningServices.generalCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="general-cleaning">General Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="deep-cleaning"
                          name="deepCleaning"
                          checked={cleaningServices.deepCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="deep-cleaning">Deep Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="vacuuming"
                          name="vacuuming"
                          checked={cleaningServices.vacuuming}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="vacuuming">Vacuuming</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="mopping"
                          name="mopping"
                          checked={cleaningServices.mopping}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="mopping">Mopping</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="dusting"
                          name="dusting"
                          checked={cleaningServices.dusting}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="dusting">Dusting</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="kitchen-cleaning"
                          name="kitchenCleaning"
                          checked={cleaningServices.kitchenCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="kitchen-cleaning">Kitchen Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="bathroom-cleaning"
                          name="bathroomCleaning"
                          checked={cleaningServices.bathroomCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="bathroom-cleaning">Bathroom Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="window-cleaning"
                          name="windowCleaning"
                          checked={cleaningServices.windowCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="window-cleaning">Window Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="appliance-cleaning"
                          name="applianceCleaning"
                          checked={cleaningServices.applianceCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="appliance-cleaning">Appliance Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="decluttering"
                          name="decluttering"
                          checked={cleaningServices.decluttering}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="decluttering">Decluttering</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="laundry"
                          name="laundry"
                          checked={cleaningServices.laundry}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="laundry">Laundry</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="dishwashing"
                          name="dishwashing"
                          checked={cleaningServices.dishwashing}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="dishwashing">Dishwashing</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="carpet-cleaning"
                          name="carpetCleaning"
                          checked={cleaningServices.carpetCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="carpet-cleaning">Carpet Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="upholstery-cleaning"
                          name="upholsteryCleaning"
                          checked={cleaningServices.upholsteryCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="upholstery-cleaning">Upholstery Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="wall-cleaning"
                          name="wallCleaning"
                          checked={cleaningServices.wallCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="wall-cleaning">Wall Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="ceiling-cleaning"
                          name="ceilingCleaning"
                          checked={cleaningServices.ceilingCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="ceiling-cleaning">Ceiling Cleaning</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button 
                      className="btn btn-primary" 
                      onClick={processVideoAndGetQuote}
                    >
                      <i className="bi bi-magic me-2"></i>
                      Get Cleaning Quote
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setVideo(null);
                        setVideoUrl('');
                        setCleaningContext('');
                      }}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
                      Choose Different Video
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Processing Section */}
        {processing && (
          <section className="processing-section">
            <h3 className="section-title">Processing Your Video</h3>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-text">{progress}% Complete</div>
            </div>
            <div className="processing-step">{processingStep}</div>
            <CleaningAnimation />
          </section>
        )}

        {/* Results Section */}
        {analysis && !showUserForm && (
          <section className="results-section">
            <h3 className="section-title">Your Cleaning Quote</h3>
            <div className="analysis-container">
              <pre className="analysis-text">{analysis}</pre>
            </div>
            <div className="text-center mt-4">
              <button className="btn btn-primary" onClick={() => setShowUserForm(true)}>
                Request This Quote
              </button>
            </div>
          </section>
        )}

        {/* User Form Section */}
        {showUserForm && (
          <section className="user-form-section">
            <h3 className="section-title">Complete Your Quote Request</h3>
            <form onSubmit={saveQuoteInfo}>
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  value={userInfo.name}
                  onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  value={userInfo.email}
                  onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  id="phone"
                  value={userInfo.phone}
                  onChange={(e) => setUserInfo({...userInfo, phone: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="address">Address</label>
                <input
                  type="text"
                  className="form-control"
                  id="address"
                  value={userInfo.address}
                  onChange={(e) => setUserInfo({...userInfo, address: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="notes">Additional Notes</label>
                <textarea
                  className="form-control"
                  id="notes"
                  rows="4"
                  value={userInfo.notes}
                  onChange={(e) => setUserInfo({...userInfo, notes: e.target.value})}
                ></textarea>
              </div>
              <div className="text-center">
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-logo">QuickQuoteClean</div>
          <div className="footer-contact">
            <div className="footer-contact-item">
              <i className="bi bi-telephone"></i> +447539412914
            </div>
            <div className="footer-contact-item">
              <i className="bi bi-envelope"></i> quickquoteclean@gmail.com
            </div>
          </div>
        </div>
        <div className="copyright">
          &copy; {new Date().getFullYear()} QuickQuoteClean. All rights reserved.
        </div>
      </footer>

      {/* Thank You Modal */}
      {showThankYouModal && (
        <div className="modal-backdrop thank-you-modal">
          <div className="modal-content">
            <div className="thank-you-icon">
              <i className="bi bi-check-circle"></i>
            </div>
            <h3 className="thank-you-title">Thank You!</h3>
            <p className="thank-you-message">Your quote request has been submitted successfully. We'll contact you shortly.</p>
            {quoteId && (
              <p className="thank-you-message">Reference: {quoteId}</p>
            )}
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Get Another Quote</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
