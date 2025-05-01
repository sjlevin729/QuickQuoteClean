import React from 'react';
import './CleaningAnimation.css';

const CleaningAnimation = () => {
  return (
    <div className="cleaning-animation-container">
      <div className="room">
        <div className="wall"></div>
        <div className="floor"></div>
        <div className="window"></div>
        <div className="door">
          <div className="doorknob"></div>
        </div>
        
        {/* Clutter items that will disappear */}
        <div className="clutter clutter-1"></div>
        <div className="clutter clutter-2"></div>
        <div className="clutter clutter-3"></div>
        <div className="clutter clutter-4"></div>
        <div className="clutter clutter-5"></div>
        <div className="clutter clutter-6"></div>
        
        {/* Cleaning elements */}
        <div className="broom"></div>
        <div className="dust-particle dust-1"></div>
        <div className="dust-particle dust-2"></div>
        <div className="dust-particle dust-3"></div>
        
        {/* Sparkles to show cleanliness */}
        <div className="sparkle sparkle-1"></div>
        <div className="sparkle sparkle-2"></div>
        <div className="sparkle sparkle-3"></div>
      </div>
    </div>
  );
};

export default CleaningAnimation;
