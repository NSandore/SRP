import { fireEvent, render, screen } from '@testing-library/react';
import PageNavigator, { clampPage } from './PageNavigator';

test('clamps requested pages to the available range', () => {
  expect(clampPage(0, 12)).toBe(1);
  expect(clampPage(4, 12)).toBe(4);
  expect(clampPage(99, 12)).toBe(12);
  expect(clampPage('', 12, 5)).toBe(5);
});

test('submits a typed page and supports edge jumps', () => {
  const onPageChange = jest.fn();
  render(
    <PageNavigator page={2} totalPages={12} onPageChange={onPageChange} />
  );

  const input = screen.getByRole('textbox', { name: /page number/i });
  fireEvent.change(input, { target: { value: '5' } });
  fireEvent.submit(screen.getByRole('form', { name: /go to page/i }));
  expect(onPageChange).toHaveBeenLastCalledWith(5);

  fireEvent.click(screen.getByRole('button', { name: /last page/i }));
  expect(onPageChange).toHaveBeenLastCalledWith(12);
});

test('clamps out-of-range typed pages and disables navigation at an edge', () => {
  const onPageChange = jest.fn();
  const { rerender } = render(
    <PageNavigator page={1} totalPages={7} onPageChange={onPageChange} />
  );

  expect(screen.getByRole('button', { name: /first page/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();

  fireEvent.change(screen.getByRole('textbox', { name: /page number/i }), {
    target: { value: '99' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^go$/i }));
  expect(onPageChange).toHaveBeenLastCalledWith(7);

  rerender(<PageNavigator page={7} totalPages={7} onPageChange={onPageChange} />);
  expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('7');
  expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /last page/i })).toBeDisabled();
});
