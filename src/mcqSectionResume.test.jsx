import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function boot(user) {
  const view = render(<BrowserRouter><App /></BrowserRouter>);
  await user.type(await screen.findByLabelText('Όνομα προφίλ'), 'McqResumeTest');
  await user.click(screen.getByRole('button', { name: /Συνέχεια/ }));
  await waitFor(() => expect(view.container.querySelector('.home-modules')).toBeTruthy());
  await user.click(within(view.container.querySelector('.home-modules')).getByRole('button', {
    name: 'Πολλαπλής Επιλογής', exact: true,
  }));
  await screen.findByText('Mini-test', {}, { timeout: 10000 });
  return view;
}

async function leaveAndReturn(user, destination = 'Προφορικά') {
  const tabs = screen.getByRole('navigation', { name: 'Ενότητες' });
  await user.click(within(tabs).getByRole('button', { name: destination }));
  await waitFor(() => expect(window.location.pathname).not.toMatch(/^\/mcq/));
  await user.click(within(tabs).getByRole('button', { name: 'Πολλαπλής' }));
}

describe('Unintentional section navigation during MCQs', () => {
  it('restores randomized practice at the exact selected answer and original question order', async () => {
    const user = userEvent.setup();
    const { container } = await boot(user);
    await user.click(screen.getByText('Τυχαία Θέματα', { exact: true }));
    await waitFor(() => expect(container.querySelector('.question-stem')).toBeTruthy());
    expect(window.location.pathname).toBe('/mcq/random');
    const originalStem = container.querySelector('.question-stem').textContent;
    const originalQuestionElement = container.querySelector('.question-stem');
    const option = container.querySelector('.option-btn:not([disabled])');
    await user.click(option);
    expect(option).toHaveClass('selected');

    await leaveAndReturn(user);
    await waitFor(() => expect(window.location.pathname).toBe('/mcq/random'));
    expect(container.querySelector('.question-stem')).toBe(originalQuestionElement);
    expect(container.querySelector('.question-stem').textContent).toBe(originalStem);
    expect(container.querySelector('.option-btn.selected')).toBe(option);
  }, 20000);

  it('restores a 100-question written examination at the same question and selected option', async () => {
    const user = userEvent.setup();
    const { container } = await boot(user);
    await user.click(screen.getByText('Προσομοίωση Εξετάσεων', { exact: true }));
    await waitFor(() => expect(container.querySelector('.mcq-question-header')).toBeTruthy());
    const nav = container.querySelector('.mobile-sim-tray-btn');
    await user.click(nav);
    const modal = container.querySelector('.sim-tray-modal');
    expect(modal).toBeTruthy();
    await user.click(within(modal).getByRole('button', { name: '15' }));
    await waitFor(() => expect(container.querySelector('.mcq-q-index').textContent).toMatch(/15/));
    const stem = container.querySelector('.question-stem');
    const option = container.querySelector('.option-btn');
    await user.click(option);
    expect(option).toHaveClass('selected');

    await leaveAndReturn(user, 'SOS');
    await waitFor(() => expect(window.location.pathname).toBe('/mcq/written'));
    expect(container.querySelector('.question-stem')).toBe(stem);
    expect(container.querySelector('.mcq-q-index').textContent).toMatch(/15/);
    expect(container.querySelector('.option-btn.selected')).toBe(option);
  }, 20000);

  it('does not silently return to a deliberately exited MCQ session', async () => {
    const user = userEvent.setup();
    const { container } = await boot(user);
    await user.click(screen.getByText('Τυχαία Θέματα', { exact: true }));
    await waitFor(() => expect(container.querySelector('.mcq-header-back-btn')).toBeTruthy());
    await user.click(container.querySelector('.mcq-header-back-btn'));
    await waitFor(() => expect(window.location.pathname).toBe('/mcq'));
    await leaveAndReturn(user);
    expect(window.location.pathname).toBe('/mcq');
    expect(screen.getByText('Mini-test', { exact: true })).toBeInTheDocument();
  }, 20000);
});
