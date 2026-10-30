import { fireEvent, render, screen } from '@testing-library/react';
import WelcomeOverlay from './WelcomeOverlay';

test('welcomes the member with a friendly guide and runs the primary action', () => {
  const onExplore = jest.fn();
  render(
    <WelcomeOverlay
      firstName="Casey"
      onExplore={onExplore}
      onDismiss={jest.fn()}
    />
  );

  expect(screen.getByRole('dialog')).toHaveAccessibleName(/let’s get you settled/i);
  expect(screen.getByText(/hi casey/i)).toBeInTheDocument();
  expect(screen.getByText(/your getting-started guide/i)).toBeInTheDocument();

  const primaryAction = screen.getByRole('button', { name: /meet the ambassadors/i });
  expect(primaryAction).toHaveFocus();
  fireEvent.click(primaryAction);
  expect(onExplore).toHaveBeenCalledTimes(1);
});

test('dismisses from the secondary action, backdrop, and Escape key', () => {
  const onDismiss = jest.fn();
  const { unmount } = render(
    <WelcomeOverlay onExplore={jest.fn()} onDismiss={onDismiss} />
  );
  expect(document.body).toHaveClass('modal-open');

  fireEvent.click(screen.getByRole('button', { name: /explore on my own/i }));
  expect(onDismiss).toHaveBeenCalledTimes(1);

  const dialog = screen.getByRole('dialog');
  fireEvent.pointerDown(dialog);
  expect(onDismiss).toHaveBeenCalledTimes(2);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onDismiss).toHaveBeenCalledTimes(3);

  unmount();
  expect(document.body).not.toHaveClass('modal-open');
});
