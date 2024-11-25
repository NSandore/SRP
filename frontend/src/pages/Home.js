// src/pages/Home.js

import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const Home = () => {
    const { user, logout } = useContext(AuthContext);

    const handleLogout = () => {
        logout();
    };

    return (
        <div>
            <h1>Welcome, {user.name}!</h1>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
};

export default Home;
