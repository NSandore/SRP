import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);

  return (
    <div>
      <h1>Welcome {user?.name ? user.name : 'Guest'}!</h1>
      {/* Optional: Add more content */}
    </div>
  );
};

export default Home;
