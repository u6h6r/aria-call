import React, { useState } from 'react';
import './Login.css';

function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');

  const { username, password } = credentials;

  const handleChange = (e) => {
    setCredentials((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const envUsername = process.env.REACT_APP_USERNAME;
    const envPassword = process.env.REACT_APP_PASSWORD;

    if (username === envUsername && password === envPassword) {
      onLogin();
    } else {
      setError('Nieprawidłowa nazwa użytkownika lub hasło.');
    }
  };

  return (
    <div className="login-container">
      <h2>Zaloguj się</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Nazwa użytkownika</label>
          <input
            type="text"
            name="username"
            value={username}
            onChange={handleChange}
            required
          />
        </div>
        <div className="input-group">
          <label>Hasło</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={handleChange}
            required
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit">Zaloguj</button>
      </form>
    </div>
  );
}

export default Login;
