import React, { useState, useEffect } from 'react';
import './Admin.css';

function Admin() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuote, setEditedQuote] = useState('');
  const [editedUserInfo, setEditedUserInfo] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionType, setActionType] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/quotes');
      
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      
      const data = await response.json();
      setQuotes(data.quotes || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      setError('Failed to load quotes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuoteDetails = async (quoteId) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch quote details');
      }
      
      const data = await response.json();
      setSelectedQuote(data.quote);
      setUserInfo(data.userInfo);
      
      // Reset editing state
      setIsEditing(false);
      setEditedQuote('');
      setEditedUserInfo(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error fetching quote details:', error);
      setError('Failed to load quote details. Please try again later.');
    }
  };

  const handleQuoteClick = (quoteId) => {
    fetchQuoteDetails(quoteId);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedQuote(selectedQuote.quote_text);
    setEditedUserInfo({...userInfo});
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedQuote('');
    setEditedUserInfo(null);
  };

  const handleSaveEdit = async () => {
    try {
      setActionMessage('Saving changes...');
      setActionType('info');
      
      // Update quote text
      const quoteResponse = await fetch(`/api/quotes/${selectedQuote.id}/text`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteText: editedQuote
        }),
      });
      
      if (!quoteResponse.ok) {
        throw new Error('Failed to update quote text');
      }
      
      // Update user information
      const userResponse = await fetch(`/api/quotes/${selectedQuote.id}/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInfo: editedUserInfo
        }),
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to update user information');
      }
      
      // Refresh quote details
      await fetchQuoteDetails(selectedQuote.id);
      
      // Refresh quotes list
      await fetchQuotes();
      
      setActionMessage('Changes saved successfully!');
      setActionType('success');
      
      // Clear action message after 3 seconds
      setTimeout(() => {
        setActionMessage('');
        setActionType('');
      }, 3000);
      
    } catch (error) {
      console.error('Error saving changes:', error);
      setActionMessage(`Error: ${error.message}`);
      setActionType('danger');
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setActionMessage('Deleting quote...');
      setActionType('info');
      
      const response = await fetch(`/api/quotes/${selectedQuote.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete quote');
      }
      
      // Refresh quotes list
      await fetchQuotes();
      
      setActionMessage('Quote deleted successfully!');
      setActionType('success');
      
      // Clear selected quote
      setSelectedQuote(null);
      setUserInfo(null);
      setShowDeleteConfirm(false);
      
      // Clear action message after 3 seconds
      setTimeout(() => {
        setActionMessage('');
        setActionType('');
      }, 3000);
      
    } catch (error) {
      console.error('Error deleting quote:', error);
      setActionMessage(`Error: ${error.message}`);
      setActionType('danger');
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleQuoteTextChange = (e) => {
    setEditedQuote(e.target.value);
  };

  const handleUserInfoChange = (e) => {
    const { name, value } = e.target;
    setEditedUserInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="container">
          <div className="row align-items-center">
            <div className="col">
              <h1>QuickQuote Admin</h1>
              <p>Manage cleaning quotes and customer information</p>
            </div>
            <div className="col-auto">
              <button 
                className="btn btn-outline-light" 
                onClick={fetchQuotes}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mt-4">
        {actionMessage && (
          <div className={`alert alert-${actionType} alert-dismissible fade show`} role="alert">
            {actionMessage}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => {
                setActionMessage('');
                setActionType('');
              }}
            ></button>
          </div>
        )}
        
        <div className="row">
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title h5 mb-0">All Quotes</h2>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center p-4">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading quotes...</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger m-3" role="alert">
                    {error}
                  </div>
                ) : quotes.length === 0 ? (
                  <div className="text-center p-4">
                    <p>No quotes found. Start by creating a quote in the main app.</p>
                  </div>
                ) : (
                  <div className="quote-list">
                    {quotes.map(quote => (
                      <div 
                        key={quote.id} 
                        className={`quote-list-item ${selectedQuote && selectedQuote.id === quote.id ? 'active' : ''}`}
                        onClick={() => handleQuoteClick(quote.id)}
                      >
                        <div className="quote-list-header">
                          <h3 className="quote-id">{quote.id}</h3>
                          <span className="quote-date">{formatDate(quote.created_at)}</span>
                        </div>
                        <div className="quote-list-details">
                          {quote.name && (
                            <p className="customer-name">
                              <i className="bi bi-person-fill me-2"></i>
                              {quote.name}
                            </p>
                          )}
                          {quote.email && (
                            <p className="customer-email">
                              <i className="bi bi-envelope-fill me-2"></i>
                              {quote.email}
                            </p>
                          )}
                          {quote.video_url && (
                            <span className="video-badge">
                              <i className="bi bi-camera-video-fill me-1"></i>
                              Video
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-7 mt-4 mt-lg-0">
            {selectedQuote ? (
              <div className="quote-details">
                {showDeleteConfirm ? (
                  <div className="card mb-4">
                    <div className="card-header bg-danger text-white">
                      <h2 className="card-title h5 mb-0">Confirm Deletion</h2>
                    </div>
                    <div className="card-body">
                      <p>Are you sure you want to delete quote <strong>{selectedQuote.id}</strong>?</p>
                      <p className="text-danger"><strong>Warning:</strong> This action cannot be undone. All quote data, user information, and the associated video will be permanently deleted.</p>
                      <div className="d-flex justify-content-end gap-2 mt-4">
                        <button 
                          className="btn btn-outline-secondary" 
                          onClick={handleCancelDelete}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={handleConfirmDelete}
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card mb-4">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h2 className="card-title h5 mb-0">Quote Details</h2>
                        <div className="btn-group">
                          {!isEditing ? (
                            <>
                              <button 
                                className="btn btn-sm btn-outline-primary" 
                                onClick={handleEditClick}
                              >
                                <i className="bi bi-pencil-fill me-1"></i>
                                Edit
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger" 
                                onClick={handleDeleteClick}
                              >
                                <i className="bi bi-trash-fill me-1"></i>
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                className="btn btn-sm btn-primary" 
                                onClick={handleSaveEdit}
                              >
                                <i className="bi bi-check-lg me-1"></i>
                                Save
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-secondary" 
                                onClick={handleCancelEdit}
                              >
                                <i className="bi bi-x-lg me-1"></i>
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="quote-header mb-3">
                          <h3>Quote #{selectedQuote.id}</h3>
                          <p className="text-muted">Generated on {formatDate(selectedQuote.created_at)}</p>
                        </div>
                        <div className="quote-content mb-4">
                          <h4>Cleaning Quote</h4>
                          {isEditing ? (
                            <textarea 
                              className="form-control quote-edit-textarea" 
                              value={editedQuote}
                              onChange={handleQuoteTextChange}
                              rows={10}
                            />
                          ) : (
                            <pre className="quote-text">{selectedQuote.quote_text}</pre>
                          )}
                        </div>
                        {selectedQuote.video_url && (
                          <div className="video-section mb-4">
                            <h4>Video Recording</h4>
                            <div className="video-container">
                              <video 
                                controls 
                                src={selectedQuote.video_url}
                                className="quote-video"
                              />
                            </div>
                            <div className="mt-3 d-flex justify-content-between align-items-center">
                              <div>
                                <p className="mb-0"><strong>Video URL:</strong></p>
                                <p className="video-url-display mb-0">
                                  <a 
                                    href={selectedQuote.video_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-break"
                                  >
                                    {selectedQuote.video_url}
                                  </a>
                                </p>
                              </div>
                              <div>
                                <a 
                                  href={selectedQuote.video_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn btn-primary"
                                >
                                  <i className="bi bi-box-arrow-up-right me-1"></i>
                                  Open Video
                                </a>
                                <button 
                                  className="btn btn-outline-secondary ms-2"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedQuote.video_url);
                                    alert('Video URL copied to clipboard!');
                                  }}
                                >
                                  <i className="bi bi-clipboard me-1"></i>
                                  Copy URL
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {userInfo && (
                      <div className="card">
                        <div className="card-header">
                          <h2 className="card-title h5 mb-0">Customer Information</h2>
                        </div>
                        <div className="card-body">
                          {isEditing ? (
                            <form>
                              <div className="row mb-3">
                                <div className="col-md-6">
                                  <label className="form-label">Name:</label>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    name="name"
                                    value={editedUserInfo.name || ''}
                                    onChange={handleUserInfoChange}
                                  />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Email:</label>
                                  <input 
                                    type="email" 
                                    className="form-control" 
                                    name="email"
                                    value={editedUserInfo.email || ''}
                                    onChange={handleUserInfoChange}
                                  />
                                </div>
                              </div>
                              <div className="row mb-3">
                                <div className="col-md-6">
                                  <label className="form-label">Phone:</label>
                                  <input 
                                    type="tel" 
                                    className="form-control" 
                                    name="phone"
                                    value={editedUserInfo.phone || ''}
                                    onChange={handleUserInfoChange}
                                  />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Created:</label>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    value={formatDate(userInfo.created_at)}
                                    disabled
                                  />
                                </div>
                              </div>
                              <div className="mb-3">
                                <label className="form-label">Address:</label>
                                <textarea 
                                  className="form-control" 
                                  name="address"
                                  value={editedUserInfo.address || ''}
                                  onChange={handleUserInfoChange}
                                  rows={2}
                                />
                              </div>
                              <div className="mb-3">
                                <label className="form-label">Additional Notes:</label>
                                <textarea 
                                  className="form-control" 
                                  name="notes"
                                  value={editedUserInfo.notes || ''}
                                  onChange={handleUserInfoChange}
                                  rows={3}
                                />
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="row mb-3">
                                <div className="col-md-6">
                                  <p className="mb-1"><strong>Name:</strong></p>
                                  <p>{userInfo.name || 'Not provided'}</p>
                                </div>
                                <div className="col-md-6">
                                  <p className="mb-1"><strong>Email:</strong></p>
                                  <p>{userInfo.email || 'Not provided'}</p>
                                </div>
                              </div>
                              <div className="row mb-3">
                                <div className="col-md-6">
                                  <p className="mb-1"><strong>Phone:</strong></p>
                                  <p>{userInfo.phone || 'Not provided'}</p>
                                </div>
                                <div className="col-md-6">
                                  <p className="mb-1"><strong>Created:</strong></p>
                                  <p>{formatDate(userInfo.created_at)}</p>
                                </div>
                              </div>
                              {userInfo.address && (
                                <div className="mb-3">
                                  <p className="mb-1"><strong>Address:</strong></p>
                                  <p>{userInfo.address}</p>
                                </div>
                              )}
                              {userInfo.notes && (
                                <div>
                                  <p className="mb-1"><strong>Additional Notes:</strong></p>
                                  <p>{userInfo.notes}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="card-body text-center p-5">
                  <i className="bi bi-arrow-left-circle display-4 text-muted"></i>
                  <h3 className="mt-3">Select a Quote</h3>
                  <p className="text-muted">Click on a quote from the list to view its details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="admin-footer mt-5">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <p>&copy; {new Date().getFullYear()} QuickQuote Ltd. All rights reserved.</p>
            </div>
            <div className="col-md-6 text-md-end">
              <a href="/" className="text-white text-decoration-none">
                <i className="bi bi-arrow-left me-1"></i>
                Back to Main App
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Admin;
