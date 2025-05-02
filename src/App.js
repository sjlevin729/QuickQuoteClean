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
  const [analysis, setAnalysis] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [quoteId, setQuoteId] = useState('');
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessageInterval, setLoadingMessageInterval] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [cleaningContext, setCleaningContext] = useState('');
  const [duration, setDuration] = useState(0);
  const [initialAnalysis, setInitialAnalysis] = useState(null);
  const [activityCounts, setActivityCounts] = useState(null);
  const [showAdjustmentUI, setShowAdjustmentUI] = useState(false);
  const [showAmendQuoteForm, setShowAmendQuoteForm] = useState(false);
  const [amendedCleaningContext, setAmendedCleaningContext] = useState('');
  const [isGeneratingAmendedQuote, setIsGeneratingAmendedQuote] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const uploadRef = useRef(null);
  const nativeCameraRef = useRef(null);
  const extractedImagesRef = useRef([]);
  const [processingStep, setProcessingStep] = useState('');
  const [fps, setFps] = useState(1);

  // Get a random loading message
  const getRandomLoadingMessage = () => {
    return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  };

  // Rotate loading messages
  useEffect(() => {
    let messageInterval;

    if (processing) {
      // Set initial message
      setLoadingMessage(getRandomLoadingMessage());
      
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
      setAmendedCleaningContext(cleaningContext);
    }
  }, [showAmendQuoteForm]);

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

  // Extract frames from video for the new two-step process
  const extractFramesFromVideo = async (videoFile) => {
    try {
      console.log('Starting frame extraction from video...');
      
      // Make sure FFmpeg is loaded
      if (!loaded) {
        console.log('FFmpeg not loaded yet, loading now...');
        await ffmpeg.load();
        setLoaded(true);
      }
      
      // Get video duration if not already set
      if (!duration) {
        const videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(videoFile);
        
        await new Promise((resolve) => {
          videoElement.onloadedmetadata = () => {
            setDuration(videoElement.duration);
            resolve();
          };
          
          // Add error handler
          videoElement.onerror = (e) => {
            console.error('Error loading video metadata:', e);
            setDuration(30); // Default to 30 seconds
            resolve();
          };
          
          // Add timeout in case metadata loading hangs
          setTimeout(() => {
            console.log('Metadata loading timed out, using default duration');
            setDuration(30);
            resolve();
          }, 5000);
        });
      }
      
      console.log('Video duration:', duration || 30, 'seconds');
      
      // Write the video file to FFmpeg's virtual file system
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
      
      console.log('Video file written to FFmpeg filesystem');

      // Calculate how many frames to extract (limit to 10 frames)
      const frameCount = 10;
      const frameRate = frameCount / (duration || 30); // Default to 30s if duration not available
      
      console.log('Using frame rate:', frameRate, 'fps');

      // Run FFmpeg command to extract frames
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-vf', `fps=${frameRate}`,
        '-vsync', 'vfr',
        '-q:v', '2',
        '-f', 'image2',
        'frame_%03d.jpg'
      );
      
      console.log('FFmpeg frame extraction completed');

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
          
          // Limit to 20 frames maximum to avoid memory issues
          if (i > 20) {
            console.log('Reached maximum frame limit (20)');
            break;
          }
        } catch (error) {
          // No more frames
          console.log('No more frames found at index:', i);
          break;
        }
      }

      console.log(`Successfully extracted ${frames.length} frames from video`);
      
      if (frames.length === 0) {
        throw new Error('No frames could be extracted from the video');
      }
      
      return frames;
    } catch (error) {
      console.error('Error extracting frames:', error);
      throw new Error(`Frame extraction failed: ${error.message}`);
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

      // Log the request details
      console.log('Sending API request to:', API_URL);
      console.log('With context:', cleaningContext ? 'Yes' : 'No');

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

      // Log the request details
      console.log('Sending amended quote request to:', API_URL);
      console.log('With amended context:', amendedCleaningContext ? 'Yes' : 'No');

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
      setCleaningContext(amendedCleaningContext);

      // Hide the amend form
      setShowAmendQuoteForm(false);
      setIsGeneratingAmendedQuote(false);
      setShowAdjustmentUI(true);

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
      setMessageType('error');
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
          userInfo,
          cleaningContext,
          activityCounts
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

  // Handle form submission for the new two-step process
  const handleSubmit = async () => {
    if (!video && recordedChunks.length === 0) {
      alert('Please select or record a video first.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(2);
    setAnalysis('');
    setError('');
    setLoadingMessage(getRandomLoadingMessage());
    
    // Clear any existing interval
    if (loadingMessageInterval) {
      clearInterval(loadingMessageInterval);
    }
    
    // Set up new interval for rotating messages
    const interval = setInterval(() => {
      setLoadingMessage(getRandomLoadingMessage());
    }, 5000);
    
    setLoadingMessageInterval(interval);

    try {
      console.log('Starting video processing for two-step quote...');
      
      // Create video file from recorded chunks if needed
      const videoFile = video || new File(
        [new Blob(recordedChunks, { type: 'video/webm' })], 
        `recording_${new Date().getTime()}.webm`, 
        { type: 'video/webm' }
      );
      
      // Extract frames from the video
      const frames = await extractFramesFromVideo(videoFile);
      console.log(`Successfully extracted ${frames.length} frames from video`);

      // Create a FormData object to send the frames
      const formData = new FormData();
      frames.forEach((frame) => {
        formData.append('images', frame.blob, frame.name);
      });

      // Add cleaning context if provided
      if (cleaningContext.trim()) {
        formData.append('context', cleaningContext);
      }

      // Log the request details
      console.log('Sending API request to:', '/api/analyze');
      console.log('With context:', cleaningContext ? 'Yes' : 'No');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      console.log('Initial analysis received:', data.initialAnalysis);
      
      // Set the initial analysis and activity counts
      setInitialAnalysis(data.initialAnalysis);
      setActivityCounts(data.initialAnalysis);
      setQuoteId(data.quoteId);
      
      // Show the adjustment UI
      setShowAdjustmentUI(true);
      
      // Hide video preview
      setVideoUrl('');
      
      // Scroll to the adjustment UI after a short delay to ensure it's rendered
      setTimeout(() => {
        const adjustmentSection = document.querySelector('.adjustment-section');
        if (adjustmentSection) {
          adjustmentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch (error) {
      console.error('Error processing video:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      clearInterval(loadingMessageInterval);
      setLoadingMessageInterval(null);
    }
  };

  // Handle activity count adjustment
  const handleActivityCountChange = (category, item, change) => {
    setActivityCounts(prev => {
      const newCounts = JSON.parse(JSON.stringify(prev)); // Deep clone
      
      if (category === 'rooms') {
        // Don't allow negative room counts
        const newCount = Math.max(0, newCounts.rooms[item] + change);
        newCounts.rooms[item] = newCount;
      } else if (category === 'activities') {
        // Toggle boolean activities
        newCounts.activities[item] = !newCounts.activities[item];
      }
      
      return newCounts;
    });
  };

  // Handle generating the final quote based on adjusted counts
  const handleGenerateFinalQuote = async () => {
    setIsProcessing(true);
    setError('');
    setLoadingMessage('Generating your final quote based on your adjustments...');
    
    // Clear any existing interval
    if (loadingMessageInterval) {
      clearInterval(loadingMessageInterval);
    }
    
    // Set up new interval for rotating messages
    const interval = setInterval(() => {
      setLoadingMessage(getRandomLoadingMessage());
    }, 5000);
    
    setLoadingMessageInterval(interval);

    try {
      console.log('Sending adjusted activity counts to generate final quote:', activityCounts);
      
      const response = await fetch('/api/generate-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId,
          cleaningContext,
          activityCounts
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate final quote');
      }

      console.log('Final quote received:', data.quote);
      
      // Set the final quote analysis
      setAnalysis(data.quote);
      
      // Hide the adjustment UI
      setShowAdjustmentUI(false);

    } catch (error) {
      console.error('Error generating final quote:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      clearInterval(loadingMessageInterval);
      setLoadingMessageInterval(null);
    }
  };

  // Handle amending the quote
  const handleAmendQuote = () => {
    if (initialAnalysis) {
      // If we have initial analysis, go back to adjustment UI
      setShowAdjustmentUI(true);
      setCurrentStep(2);
    } else {
      // For backward compatibility or if coming from an older quote
      setShowAmendQuoteForm(true);
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
                  onClick={() => nativeCameraRef.current.click()}
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
              
              {/* Native camera input for mobile devices */}
              <input
                type="file"
                ref={nativeCameraRef}
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    handleVideoSelect(e.target.files[0]);
                  }
                }}
                accept="video/*"
                capture="environment"
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

                  <div className="action-buttons">
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmit}
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
        {isProcessing && (
          <section className="processing-section">
            <div className="container">
              <div className="processing-container">
                <div className="spinner-container">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
                <h3 className="processing-title">Processing Your Video</h3>
                <p className="loading-message">{loadingMessage}</p>
                {error && <div className="error-message">{error}</div>}
              </div>
            </div>
          </section>
        )}

        {/* Adjustment UI Section */}
        {showAdjustmentUI && activityCounts && (
          <section className="adjustment-section">
            <div className="container">
              <h3 className="section-title">Adjust Your Cleaning Estimate</h3>
              <p className="adjustment-description">
                We've analyzed your video and estimated the following rooms and activities. 
                Please adjust these counts to match your actual needs.
              </p>
              
              <div className="adjustment-container">
                {/* AI Summary Box */}
                {initialAnalysis && initialAnalysis.summary && (
                  <div className="summary-box">
                    <h4 className="summary-title">AI Analysis Summary</h4>
                    <p className="summary-text">{initialAnalysis.summary}</p>
                    <p className="summary-instruction">
                      Based on this analysis, we've pre-configured the details below. 
                      Please review and adjust if needed.
                    </p>
                  </div>
                )}
                
                <div className="row">
                  <div className="col-md-6">
                    <div className="adjustment-card">
                      <h4 className="adjustment-card-title">Rooms</h4>
                      <div className="adjustment-items">
                        {activityCounts.rooms && Object.entries(activityCounts.rooms).map(([room, count]) => (
                          <div className="adjustment-item" key={room}>
                            <span className="adjustment-item-label">
                              {room.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </span>
                            <div className="adjustment-controls">
                              <button 
                                className="adjustment-btn" 
                                onClick={() => handleActivityCountChange('rooms', room, -1)}
                                disabled={count <= 0}
                              >
                                <i className="bi bi-dash-circle"></i>
                              </button>
                              <span className="adjustment-count">{count}</span>
                              <button 
                                className="adjustment-btn" 
                                onClick={() => handleActivityCountChange('rooms', room, 1)}
                              >
                                <i className="bi bi-plus-circle"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="adjustment-card">
                      <h4 className="adjustment-card-title">Additional Activities</h4>
                      <div className="adjustment-items">
                        {activityCounts.activities && Object.entries(activityCounts.activities).map(([activity, isSelected]) => (
                          <div className="adjustment-item" key={activity}>
                            <span className="adjustment-item-label">
                              {activity.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </span>
                            <div className="adjustment-toggle">
                              <div 
                                className={`toggle-switch ${isSelected ? 'active' : ''}`}
                                onClick={() => handleActivityCountChange('activities', activity, 0)}
                              >
                                <div className="toggle-slider"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="adjustment-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={handleGenerateFinalQuote}
                  >
                    <i className="bi bi-check-circle me-2"></i>
                    Generate Final Quote
                  </button>
                </div>
              </div>
            </div>
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
                onClick={handleAmendQuote}
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
    </div>
  );
}

export default App;
