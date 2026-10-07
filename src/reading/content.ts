import type { ReadingPassage } from './types'

const demoPassage: ReadingPassage = {
  id: 'wenyan-demo-reading-01',
  version: '1',
  title: 'The Cost of Convenience',
  source: {
    kind: 'wenyan-original',
    label: 'Wenyan original practice passage',
  },
  estimatedMinutes: 8,
  recommendationEligible: false,
  paragraphs: [
    'Digital tools often promise to remove small inconveniences from daily life. A calendar remembers appointments, a map chooses routes, and a recommendation system decides what to read next. Each tool saves a little effort, but together they may also change which decisions people continue to practise making for themselves.',
    'This does not mean convenience is harmful. The important question is what kind of effort is being removed. Few people benefit from repeatedly calculating the fastest route across a familiar city. By contrast, choosing what deserves attention is part of forming a goal. If a system makes that choice invisibly, the user may become efficient without becoming more deliberate.',
    'A better design therefore does not simply maximise automation. It separates routine decisions from meaningful ones. Routine work can disappear into the background, while decisions connected to purpose should remain visible enough to be questioned. In this sense, good automation does not replace agency; it protects attention for the moments when agency matters most.',
  ],
  questions: [
    {
      id: 'q1',
      type: 'single_choice',
      stem: 'What is the main concern raised in the first paragraph?',
      options: [
        { id: 'A', text: 'Digital tools usually fail to save users time.' },
        { id: 'B', text: 'Convenience can gradually change which decisions users still practise making.' },
        { id: 'C', text: 'Recommendation systems are less reliable than calendars.' },
        { id: 'D', text: 'People should stop using tools that make decisions automatically.' },
      ],
      correctOptionId: 'B',
      tags: ['main_idea'],
      explanation: 'The paragraph contrasts small savings in effort with the possibility that users stop practising some decisions themselves.',
    },
    {
      id: 'q2',
      type: 'single_choice',
      stem: 'According to the second paragraph, which kind of decision should remain more visible to the user?',
      options: [
        { id: 'A', text: 'A repetitive calculation with a clear objective.' },
        { id: 'B', text: 'A familiar route that has already been travelled many times.' },
        { id: 'C', text: 'A decision about what deserves attention in pursuit of a goal.' },
        { id: 'D', text: 'A routine choice that can be made with no personal consequence.' },
      ],
      correctOptionId: 'C',
      tags: ['detail'],
      explanation: 'The paragraph says choosing what deserves attention is part of forming a goal, unlike routine route calculation.',
    },
    {
      id: 'q3',
      type: 'single_choice',
      stem: 'The author would most likely agree that good automation should',
      options: [
        { id: 'A', text: 'remove every decision that can be made by software.' },
        { id: 'B', text: 'keep routine work visible so users remain constantly alert.' },
        { id: 'C', text: 'reserve human attention for decisions connected to purpose.' },
        { id: 'D', text: 'avoid making recommendations unless users request them explicitly.' },
      ],
      correctOptionId: 'C',
      tags: ['inference'],
      explanation: 'The final paragraph argues for automating routine work while preserving attention for meaningful decisions.',
    },
  ],
  vocabulary: [
    { surface: 'inconveniences', lemma: 'inconvenience', core: true },
    { surface: 'deliberate', lemma: 'deliberate', core: true },
    { surface: 'automation', lemma: 'automation', core: true },
    { surface: 'agency', lemma: 'agency', core: true },
  ],
}

const passages = new Map<string, ReadingPassage>([[demoPassage.id, demoPassage]])

export function getReadingPassage(contentId: string) {
  return passages.get(contentId)
}

export function listReadingPassages() {
  return Array.from(passages.values())
}
