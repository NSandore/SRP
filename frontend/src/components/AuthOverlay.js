import React from 'react';
import ModalOverlay from './ModalOverlay';
import Login from './Login';

function AuthOverlay({
  isOpen,
  onClose,
  onLogin,
  onGoToSignUp,
  onContinueAsGuest,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <Login
        variant="modal"
        onLogin={onLogin}
        onGoToSignUp={onGoToSignUp}
        onContinueAsGuest={onContinueAsGuest}
      />
    </ModalOverlay>
  );
}

export default AuthOverlay;
