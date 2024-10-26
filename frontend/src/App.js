import React, { useState } from 'react';
import TopBar from './components/TopBar';
import MainContent from './components/MainContent';
import Login from './components/Login';
import './styles.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);

  return (
    <div className="App">
      <TopBar />
      {isAuthenticated ? <MainContent /> : <Login onLogin={handleLogin} />}
    </div>
  );
}

export default App;
