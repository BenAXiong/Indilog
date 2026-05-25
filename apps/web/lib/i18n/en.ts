const en = {
  // Navigation
  'nav.learn':     'Learn',
  'nav.review':    'Review',
  'nav.capture':   'Capture',
  'nav.dict':      'Dictionary',
  'nav.translate': 'Translate',

  // Dashboard
  'dashboard.studying':      'Studying',
  'dashboard.change':        'Change',
  'dashboard.streak':        'day streak',
  'dashboard.streak.prompt': 'Capture today to keep it going',
  'dashboard.thisWeek':      'This week',
  'dashboard.activity':      'Activity',
  'dashboard.recentCaptures':'Recent captures',

  // Stats
  'stats.captures': 'Captures',
  'stats.reviewed': 'Reviewed',
  'stats.due':      'Due today',
  'stats.lessons':  'Lessons',

  // Capture
  'capture.placeholder':  'A word, sentence, or note you want to keep…',
  'capture.tapToGloss':   'tap to add gloss',
  'capture.context':      'Context',
  'capture.source':       'Source',
  'capture.speaker':      'Speaker',
  'capture.speakerHint':  '(optional)',
  'capture.place':        'Place',
  'capture.placeHint':    'Where heard / seen',
  'capture.notes':        'Notes',
  'capture.notesHint':    'Anything to remember…',
  'capture.lookup':       'Lookup',
  'capture.translate':    'Translate',
  'capture.save':         'Save',
  'capture.clear':        'Clear',
  'capture.saved':        'Saved to your notebook',

  // Review
  'review.dueToday':          'Due today',
  'review.startReview':       'Start review',
  'review.comprehension':     'Comprehension',
  'review.comprehension.sub': 'See the meaning — say the sentence',
  'review.expression':        'Expression',
  'review.expression.sub':    'Hear the sentence — guess the sentence',
  'review.dialogueDrill':     'Dialogue drill',
  'review.seeAll':            'See all',
  'review.revealAnswer':      'Reveal answer',
  'review.hearIt':            'Hear it',
  'review.rating.again':      'Again',
  'review.rating.hard':       'Hard',
  'review.rating.good':       'Good',
  'review.rating.easy':       'Easy',

  // Dictionary
  'dict.placeholder':  'Type a word…',
  'dict.sources':      'Sources',
  'dict.exact':        'exact',
  'dict.alsoMatches':  'Also matches',
  'dict.examples':     'Examples',
  'dict.saveWord':     'Save word',
  'dict.addContext':   'Add context',

  // Translate
  'translate.subtitle':    'Independent of your study language · supported pairs only',
  'translate.from':        'From',
  'translate.to':          'To',
  'translate.clear':       'Clear',
  'translate.copy':        'Copy',
  'translate.listen':      'Listen',
  'translate.save':        'Save',
  'translate.disclaimer':  'AI translations approximate. Verify with a fluent speaker before relying on them.',
  'translate.unsupported': '· soon',

  // Settings
  'settings.studying':    'Active study language',
  'settings.seeAll':      'See all 16 Formosan languages',
  'settings.preferences': 'Preferences',
  'settings.locale':      'Interface language',
  'settings.localeSoon':  '· soon',
  'settings.dailyGoal':   'Daily review goal',
  'settings.goalCards':   'cards',
  'settings.account':     'Account',
  'settings.export':      'Export notebook',
  'settings.about':       'About Indivore',
  'settings.signOut':     'Sign out',
  'settings.synced':      'synced',

  // General
  'general.loading': 'Loading…',
  'general.error':   'Something went wrong.',
  'general.empty':   'Nothing here yet.',
  'general.cards':   'cards',
  'general.min':     'min',
  'general.comingSoon': 'Coming soon.',
} as const

export type MessageKey = keyof typeof en
export default en
