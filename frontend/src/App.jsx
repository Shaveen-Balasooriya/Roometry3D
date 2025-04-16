import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AddFurniture from './pages/AddFurniture';
import './styles/App.css';
import './styles/index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<AddFurniture />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
