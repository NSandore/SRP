import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';

// This previously asserted on the untouched create-react-app boilerplate
// ("learn react" link), which the real App never renders — it always
// failed to find that text and, since App uses react-router hooks, also
// crashed outside a Router. It never actually exercised anything.
//
// App fetches the current session on mount and renders a loading state
// until that resolves; a unit test shouldn't depend on a real network call
// settling, so this only asserts the initial render succeeds without
// crashing and reaches that loading state.
test('renders without crashing and shows the initial loading state', () => {
  const { container } = render(
    <MemoryRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </MemoryRouter>
  );
  expect(container.textContent).toMatch(/loading/i);
});
