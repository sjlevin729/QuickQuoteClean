import React, { useState, useEffect, useRef } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import './App.css';

// Initialize FFmpeg
const ffmpeg = createFFmpeg({
  log: false, // Set to false to hide logs
  corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
});

// API endpoint for image analysis
const API_URL = '/api/analyze-images';

// Funny loading messages
const loadingMessages = [
  "Dust bunnies are multiplying as we speak. We're calculating their eviction notice",
  "Polishing our crystal ball to predict the perfect price for your sparkle",
  "Summoning the cleaning fairies... they're a bit slow after their tea break",
  "Hold tight! We're just herding the dirt particles into a neat little pile for you",
  "Calculating the precise amount of elbow grease required",
  "We're not just generating a quote, we're crafting a masterpiece of cleanliness. Almost there!",
  "Your patience is appreciated. Unlike the stubborn stains we're about to tackle",
  "Brewing up the perfect price, just like a strong cup of cleaning solution"
];

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
  const [quoteId, setQuoteId] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [videoStorageUrl, setVideoStorageUrl] = useState('');
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [cleaningContext, setCleaningContext] = useState('');
  const [duration, setDuration] = useState(0);
  const [cleaningServices, setCleaningServices] = useState({
    generalCleaning: true,
    deepCleaning: false,
    kitchenBathroom: false,
    floorCleaning: false,
    windowsCleaning: false,
    organizingDecluttering: false
  });
  const [showAmendQuoteForm, setShowAmendQuoteForm] = useState(false);
  const [amendedCleaningContext, setAmendedCleaningContext] = useState('');
  const [amendedCleaningServices, setAmendedCleaningServices] = useState({});
  const [isGeneratingAmendedQuote, setIsGeneratingAmendedQuote] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const videoRef = useRef(null);
  const recordingTimeRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const uploadRef = useRef(null);
  const extractedImagesRef = useRef([]);
  const [processingStep, setProcessingStep] = useState('');
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  // Rotate loading messages
  useEffect(() => {
    let messageInterval;

    if (processing) {
      // Set initial message
      setLoadingMessage(loadingMessages[0]);
      
      // Rotate messages every 4 seconds
      let messageIndex = 1;
      messageInterval = setInterval(() => {
        setLoadingMessage(loadingMessages[messageIndex]);
        messageIndex = (messageIndex + 1) % loadingMessages.length;
      }, 4000);
    } else {
      // Clear message when not processing
      setLoadingMessage('');
    }
    
    return () => {
      if (messageInterval) {
        clearInterval(messageInterval);
      }
    };
  }, [processing]);

  // Initialize amended services when showing the amend form
  useEffect(() => {
    if (showAmendQuoteForm) {
      setAmendedCleaningServices({...cleaningServices});
      setAmendedCleaningContext(cleaningContext);
    }
  }, [showAmendQuoteForm]);

  // Handle checkbox change for amended services
  const handleAmendedServiceChange = (e) => {
    const { name, checked } = e.target;
    setAmendedCleaningServices(prev => ({
      ...prev,
      [name]: checked
    }));
  };

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
      setAnalysis('');
      setMessage('');
      setProcessingStep('Analyzing video...');

      // Step 1: Extract frames from video
      await extractFrames();

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

  // Generate an amended quote
  const generateAmendedQuote = async () => {
    try {
      setIsGeneratingAmendedQuote(true);
      setMessage('');

      const formData = new FormData();

      // Add the extracted images to the form data
      if (extractedImagesRef.current.length === 0) {
        throw new Error('No images available for analysis');
      }

      // Limit the number of images to avoid payload size issues
      const maxImages = 10;
      const imageFiles = extractedImagesRef.current;
      const limitedImages = imageFiles.length > maxImages
        ? imageFiles.filter((_, index) => index % Math.ceil(imageFiles.length / maxImages) === 0).slice(0, maxImages)
        : imageFiles;

      // Add each image to the form data
      limitedImages.forEach((image, index) => {
        formData.append('images', image.blob, image.name);
      });

      // Add amended cleaning context to the request if provided
      if (amendedCleaningContext.trim()) {
        formData.append('context', amendedCleaningContext);
      }

      // Add amended selected cleaning services to the request
      formData.append('services', JSON.stringify(amendedCleaningServices));

      // Log the request details
      console.log('Sending amended quote request to:', API_URL);
      console.log('With amended context:', amendedCleaningContext ? 'Yes' : 'No');
      console.log('Amended selected services:', Object.entries(amendedCleaningServices)
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

      // Update state with the new quote
      setAnalysis(formattedAnalysis);
      setQuoteId(data.quoteId || `QQ${Math.floor(Math.random() * 10000)}`);

      // Update the original services and context with the amended ones
      setCleaningServices({...amendedCleaningServices});
      setCleaningContext(amendedCleaningContext);

      // Hide the amend form
      setShowAmendQuoteForm(false);
      setIsGeneratingAmendedQuote(false);

    } catch (error) {
      console.error('Error generating amended quote:', error);
      setMessage(`Failed to generate amended quote: ${error.message}`);
      setMessageType('danger');
      setIsGeneratingAmendedQuote(false);
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

  // Start camera for recording
  const startCamera = async () => {
    try {
      // Reset recording state
      setRecordedChunks([]);
      setRecordingTime(0);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      // Set stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraStream(stream);
      setShowCameraModal(true);
      setMessage('');

    } catch (error) {
      console.error('Error accessing camera:', error);
      setMessage(`Could not access camera: ${error.message}. Please check your camera permissions.`);
      setMessageType('danger');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }

    setIsRecording(false);
    setShowCameraModal(false);
  };

  // Start recording
  const startRecording = () => {
    if (!cameraStream) return;

    try {
      // Create media recorder
      const recorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm' });

      // Handle data available event
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      // Handle recording stop
      recorder.onstop = () => {
        // Create blob from recorded chunks
        const blob = new Blob(recordedChunks, { type: 'video/webm' });

        // Create file from blob
        const file = new File([blob], `recording_${new Date().getTime()}.webm`, { type: 'video/webm' });

        // Handle the recorded video like an uploaded file
        handleVideoSelect(file);

        // Clear recording state
        setRecordedChunks([]);
        setRecordingTime(0);

        // Close camera modal
        setShowCameraModal(false);
      };

      // Start recording
      recorder.start(1000); // Collect data in 1-second chunks
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Start recording timer
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setRecordingInterval(interval);

    } catch (error) {
      console.error('Error starting recording:', error);
      setMessage(`Could not start recording: ${error.message}`);
      setMessageType('danger');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }

    setIsRecording(false);
  };

  // Format recording time (mm:ss)
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                  handleVideoSelect(files[0]);
                } else {
                  setMessage('Please drop a valid video file.');
                  setMessageType('warning');
                }
              }}
            >
              <div className="upload-icon">
                <i className="bi bi-cloud-arrow-up"></i>
              </div>
              <h3 className="upload-text">Upload a Video</h3>
              <p className="upload-subtext">Click or drag and drop your video here</p>
              <p className="upload-subtext">Supported formats: MP4, MOV, AVI, WEBM (Max 100MB)</p>

              <div className="upload-options">
                <button
                  className="btn btn-primary upload-btn"
                  onClick={() => uploadRef.current.click()}
                >
                  <i className="bi bi-file-earmark-arrow-up me-2"></i>
                  Choose File
                </button>

                <span className="upload-divider">or</span>

                <button
                  className="btn btn-secondary record-btn"
                  onClick={startCamera}
                >
                  <i className="bi bi-camera-video me-2"></i>
                  Record Video
                </button>
              </div>

              <input
                type="file"
                ref={uploadRef}
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    handleVideoSelect(e.target.files[0]);
                  }
                }}
                accept="video/*"
                style={{ display: 'none' }}
              />
            </div>
          </section>
        )}

        {/* Camera Modal */}
        {showCameraModal && (
          <div className="modal-backdrop camera-modal">
            <div className="modal-content camera-modal-content">
              <div className="camera-header">
                <h3 className="camera-title">Record Video</h3>
                <button
                  className="close-btn"
                  onClick={stopCamera}
                  aria-label="Close"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="camera-body">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-preview"
                ></video>

                <div className="recording-info">
                  {isRecording && (
                    <div className="recording-indicator">
                      <span className="recording-dot"></span>
                      Recording: {formatRecordingTime(recordingTime)}
                    </div>
                  )}
                </div>
              </div>

              <div className="camera-footer">
                {!isRecording ? (
                  <button
                    className="btn btn-danger record-btn"
                    onClick={startRecording}
                  >
                    <i className="bi bi-record-circle me-2"></i>
                    Start Recording
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary stop-btn"
                    onClick={stopRecording}
                  >
                    <i className="bi bi-stop-circle me-2"></i>
                    Stop Recording
                  </button>
                )}
              </div>
            </div>
          </div>
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
                    <p className="context-helper mb-3">
                      Select any additional cleaning services you'd like included in your quote, even if they're not shown in the video.
                      This helps us provide a more accurate and comprehensive cleaning quote for your specific needs.
                    </p>
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
                          id="kitchen-bathroom"
                          name="kitchenBathroom"
                          checked={cleaningServices.kitchenBathroom}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="kitchen-bathroom">Kitchen & Bathroom Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="floor-cleaning"
                          name="floorCleaning"
                          checked={cleaningServices.floorCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="floor-cleaning">Floor Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="windows-cleaning"
                          name="windowsCleaning"
                          checked={cleaningServices.windowsCleaning}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="windows-cleaning">Windows Cleaning</label>
                      </div>
                      <div className="checkbox-item">
                        <input
                          type="checkbox"
                          id="organizing-decluttering"
                          name="organizingDecluttering"
                          checked={cleaningServices.organizingDecluttering}
                          onChange={handleServiceChange}
                        />
                        <label className="checkbox-label" htmlFor="organizing-decluttering">Organizing & Decluttering</label>
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
            <h3 className="processing-title">Generating Your Cleaning Quote</h3>
            <div className="loading-message">{loadingMessage || "Analyzing your space and calculating the perfect cleaning plan..."}</div>
            <div className="cleaning-animation-container">
              <div className="cleaning-animation">
                <div className="table-surface"></div>
                <div className="hand">
                  <div className="cloth"></div>
                </div>
                <div className="dirt-particles">
                  <div className="dirt-particle p1"></div>
                  <div className="dirt-particle p2"></div>
                  <div className="dirt-particle p3"></div>
                  <div className="dirt-particle p4"></div>
                  <div className="dirt-particle p5"></div>
                </div>
              </div>
            </div>
            <div className="processing-step">{processingStep}</div>
          </section>
        )}

        {/* Results Section */}
        {analysis && !showUserForm && !showAmendQuoteForm && (
          <section className="results-section">
            <h3 className="section-title">Your Cleaning Quote</h3>
            <div className="analysis-container">
              <pre className="analysis-text">{analysis}</pre>
            </div>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={() => setShowUserForm(true)}>
                <i className="bi bi-check-circle me-2"></i>
                Accept Quote
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAmendQuoteForm(true)}
              >
                <i className="bi bi-pencil me-2"></i>
                Amend Quote
              </button>
            </div>
          </section>
        )}

        {/* Amend Quote Section */}
        {showAmendQuoteForm && (
          <section className="amend-quote-section">
            <h3 className="section-title">Amend Your Quote</h3>
            <div className="amend-quote-content">
              <div className="form-group">
                <label className="context-label" htmlFor="amended-cleaning-context">
                  Amended Cleaning Requirements
                </label>
                <textarea
                  id="amended-cleaning-context"
                  className="context-textarea"
                  placeholder="Tell us about any changes to your cleaning needs, preferences, or any areas that need special attention..."
                  value={amendedCleaningContext}
                  onChange={(e) => setAmendedCleaningContext(e.target.value)}
                ></textarea>
                <p className="context-helper">This information will help our AI provide a more accurate quote.</p>
              </div>

              <div className="form-group">
                <label className="context-label" htmlFor="amended-cleaning-services">
                  Select Amended Cleaning Services
                </label>
                <p className="context-helper mb-3">
                  Select any additional cleaning services you'd like included in your quote, even if they're not shown in the video.
                  This helps us provide a more accurate and comprehensive cleaning quote for your specific needs.
                </p>
                <div className="checkbox-group">
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-general-cleaning"
                      name="generalCleaning"
                      checked={amendedCleaningServices.generalCleaning}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-general-cleaning">General Cleaning</label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-deep-cleaning"
                      name="deepCleaning"
                      checked={amendedCleaningServices.deepCleaning}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-deep-cleaning">Deep Cleaning</label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-kitchen-bathroom"
                      name="kitchenBathroom"
                      checked={amendedCleaningServices.kitchenBathroom}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-kitchen-bathroom">Kitchen & Bathroom Cleaning</label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-floor-cleaning"
                      name="floorCleaning"
                      checked={amendedCleaningServices.floorCleaning}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-floor-cleaning">Floor Cleaning</label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-windows-cleaning"
                      name="windowsCleaning"
                      checked={amendedCleaningServices.windowsCleaning}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-windows-cleaning">Windows Cleaning</label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="amended-organizing-decluttering"
                      name="organizingDecluttering"
                      checked={amendedCleaningServices.organizingDecluttering}
                      onChange={handleAmendedServiceChange}
                    />
                    <label className="checkbox-label" htmlFor="amended-organizing-decluttering">Organizing & Decluttering</label>
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={generateAmendedQuote}
                  disabled={isGeneratingAmendedQuote}
                >
                  {isGeneratingAmendedQuote ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-magic me-2"></i>
                      Generate Amended Quote
                    </>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAmendQuoteForm(false)}
                  disabled={isGeneratingAmendedQuote}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Cancel
                </button>
              </div>
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
