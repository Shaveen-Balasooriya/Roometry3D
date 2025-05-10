import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './RoomEnvironment.css';

/**
 * A debugging component to diagnose issues with the RoomEnvironment component
 */
function RoomEnvironmentDebugger() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [error, setError] = useState(null);
  const [roomData, setRoomData] = useState(null);
  
  useEffect(() => {
    console.log("RoomEnvironmentDebugger mounted");
    console.log("Location state:", location.state);
    console.log("URL params:", params);
    
    if (!location.state || !location.state.roomData) {
      setError("No room data found in navigation state");
      console.error("No room data found in navigation state");
    } else {
      setRoomData(location.state.roomData);
      
      if (!location.state.roomData.modelUrl) {
        setError("Room data found, but missing modelUrl property");
        console.error("Room data is missing modelUrl:", location.state.roomData);
      }
    }
  }, [location.state, params]);

  // Go back to room selection
  const handleBack = () => {
    navigate("/room-scaper");
  };

  return (
    <div className="room-environment-container">
      <div className="room-environment-header">
        <button className="back-button" onClick={handleBack}>
          ← Back to Room Selection
        </button>
        <h1>Room Environment Debugger</h1>
      </div>

      <div className="debug-container">
        <div className="debug-panel">
          <h2>Room Environment Debug Information</h2>
          
          {error && (
            <div className="error-message">
              <h3>Error:</h3>
              <p>{error}</p>
            </div>
          )}
          
          <div className="debug-section">
            <h3>Room ID from URL:</h3>
            <p>{params.roomId || "No room ID in URL params"}</p>
          </div>
          
          <div className="debug-section">
            <h3>Room Data Available:</h3>
            <p>{roomData ? "Yes" : "No"}</p>
          </div>
          
          {roomData && (
            <>
              <div className="debug-section">
                <h3>Room Name:</h3>
                <p>{roomData.name || "Unnamed Room"}</p>
              </div>
              
              <div className="debug-section">
                <h3>Model URL Present:</h3>
                <p>{roomData.modelUrl ? "Yes" : "No"}</p>
              </div>
              
              {roomData.modelUrl && (
                <div className="debug-section">
                  <h3>Model URL:</h3>
                  <p className="model-url">{roomData.modelUrl}</p>
                  <button 
                    className="test-button"
                    onClick={() => window.open(roomData.modelUrl, "_blank")}
                  >
                    Test URL
                  </button>
                </div>
              )}
              
              <div className="debug-section">
                <h3>Full Room Data:</h3>
                <pre className="data-display">{JSON.stringify(roomData, null, 2)}</pre>
              </div>
            </>
          )}
          
          <div className="debug-section">
            <h3>Navigation State:</h3>
            <pre className="data-display">{JSON.stringify(location.state, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomEnvironmentDebugger;