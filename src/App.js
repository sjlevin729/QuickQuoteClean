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
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
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

        {/* Message Display */}
        {message && (
          <div className={`message message-${messageType}`}>
            {message}
          </div>
        )}

        {/* Upload Section */}
        {!processing && !analysis && (
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
