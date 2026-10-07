import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WrongAnswerPractice from './WrongAnswerPractice.jsx';

afterEach(cleanup);
const questions = [
  { id: 'one', stem: 'Single answer', options: ['Correct', 'Wrong'], correct: 0, explanation: 'Single explanation' },
  { id: 'multi', stem: 'Multiple answers', options: ['First', 'Second', 'Distractor'], correct: [0, 1], explanation: 'Multiple explanation' },
];
it('grades multiple selections exactly and retries only the remaining wrong answer', async () => {
  const user = userEvent.setup();
  const onAnswer = vi.fn();
  const onBack = vi.fn();
  render(<WrongAnswerPractice questions={questions} title="Original test" context="Original case" onAnswer={onAnswer} onBack={onBack} />);
  expect(screen.getByText('Original case')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Correct' }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('Single explanation')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Επόμενη/ }));
  await user.click(screen.getByRole('button', { name: 'First' }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('1/2')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Επανάληψη των υπόλοιπων 1 λαθών' }));
  expect(screen.getByText('Multiple answers')).toBeInTheDocument();
  expect(screen.queryByText('Single answer')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: 'First' }));
  await user.click(screen.getByRole('button', { name: 'Second' }));
  await user.click(screen.getByRole('button', { name: /Καταχώρηση/ }));
  expect(screen.getByText('Όλες οι απαντήσεις σωστές!')).toBeInTheDocument();
  expect(onAnswer).toHaveBeenCalledTimes(3);
  expect(onAnswer.mock.calls[0][1]).toBe(0);
  expect(onAnswer.mock.calls[1][1]).toEqual([0]);
  expect(onAnswer.mock.calls[2][1]).toEqual(expect.arrayContaining([0, 1]));
  expect(onAnswer.mock.calls[2][2].sessionId).not.toBe(onAnswer.mock.calls[0][2].sessionId);
  await user.click(screen.getByRole('button', { name: 'Επιστροφή στο αρχικό τεστ' }));
  expect(onBack).toHaveBeenCalledOnce();
});

it('ignores keyboard input when a kept-mounted mini-test is hidden', async () => {
  const user = userEvent.setup();
  const onAnswer = vi.fn();
  render(<WrongAnswerPractice questions={[questions[0]]} isActive={false} onAnswer={onAnswer} />);
  await user.keyboard('1{Enter}');
  expect(onAnswer).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Correct' })).toHaveAttribute('aria-pressed', 'false');
});
