import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TestControls from './TestControls';

const renderControls = (overrides = {}) => {
  const handlers = {
    onReplayGuide: jest.fn().mockResolvedValue(undefined),
    onTestNotification: jest.fn().mockResolvedValue(undefined),
    onShowWelcome: jest.fn().mockResolvedValue(undefined),
    onShowAmbassadors: jest.fn().mockResolvedValue(undefined),
    onSendTestEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(
    <TestControls
      {...handlers}
    />
  );
  return handlers;
};

test.each([
  ['Replay guide', 'onReplayGuide'],
  ['Test notification', 'onTestNotification'],
  ['Show welcome', 'onShowWelcome'],
  ['Show ambassadors', 'onShowAmbassadors'],
  ['Send test email', 'onSendTestEmail'],
])('runs the %s action and closes the panel', async (label, handlerName) => {
  const handlers = renderControls();

  fireEvent.click(screen.getByRole('button', { name: /test tools/i }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));

  await waitFor(() => {
    expect(handlers[handlerName]).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /test tools/i })).toHaveAttribute('aria-expanded', 'false');
  });
});

test('keeps the panel open and reports a failed action', async () => {
  renderControls({
    onSendTestEmail: jest.fn().mockRejectedValue(new Error('Email provider unavailable.')),
  });

  fireEvent.click(screen.getByRole('button', { name: /test tools/i }));
  fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Email provider unavailable.');
  expect(screen.getByRole('button', { name: /test tools/i })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: /send test email/i })).toBeEnabled();
});

test('closes on Escape and restores focus to the trigger', () => {
  renderControls();
  const trigger = screen.getByRole('button', { name: /test tools/i });

  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });

  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();
});
